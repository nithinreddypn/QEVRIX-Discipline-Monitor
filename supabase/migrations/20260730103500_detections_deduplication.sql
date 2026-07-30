-- Database deduplication and repeat sighting handling migration

-- 1. Add repeat columns to detections table
ALTER TABLE public.detections
ADD COLUMN IF NOT EXISTS is_repeat boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS repeat_count integer DEFAULT 0;

-- 2. Clean up existing duplicate detection image urls to avoid unique constraint failures
DELETE FROM public.detections
WHERE id NOT IN (
  SELECT MIN(id::text)::uuid
  FROM public.detections
  GROUP BY image_url
);

-- 3. Add UNIQUE constraint on detections.image_url
ALTER TABLE public.detections
DROP CONSTRAINT IF EXISTS unique_detections_image_url;

ALTER TABLE public.detections
ADD CONSTRAINT unique_detections_image_url UNIQUE (image_url);

-- 4. Redefine BEFORE trigger function to calculate is_repeat and repeat_count (5-minute sliding window check)
CREATE OR REPLACE FUNCTION public.process_detection_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_color text;
  v_match boolean;
  v_prior_count integer;
BEGIN
  -- Check for repeat sighting within the last 5 minutes if student is recognized
  IF NEW.student_id IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_prior_count
    FROM public.detections
    WHERE student_id = NEW.student_id
      AND detection_time >= NEW.detection_time - interval '5 minutes';
      
    IF v_prior_count > 0 THEN
      NEW.is_repeat := true;
      NEW.repeat_count := v_prior_count + 1;
    ELSE
      NEW.is_repeat := false;
      NEW.repeat_count := 1;
    END IF;
  ELSE
    NEW.is_repeat := false;
    NEW.repeat_count := 0;
  END IF;

  -- Color matching & validation logic
  IF NEW.student_id IS NOT NULL THEN
    -- Look up branch reference color
    SELECT b.color_hex INTO v_branch_color
    FROM public.students s
    LEFT JOIN public.branches b ON b.id = s.branch_id
    WHERE s.id = NEW.student_id;

    IF NEW.expected_branch_color IS NULL THEN
      NEW.expected_branch_color := v_branch_color;
    END IF;

    IF NEW.id_card_color IS NOT NULL AND v_branch_color IS NOT NULL THEN
      v_match := public.hex_color_close(NEW.id_card_color, v_branch_color, 60);
      NEW.color_match := v_match;
      NEW.status := CASE WHEN v_match THEN 'verified' ELSE 'flagged' END;
    ELSE
      NEW.status := COALESCE(NEW.status, 'pending');
    END IF;
  ELSE
    IF NEW.id_card_found = false THEN
      NEW.status := COALESCE(NEW.status, 'flagged');
    ELSE
      NEW.status := COALESCE(NEW.status, 'flagged');
    END IF;
  END IF;

  -- Ensure notification_sent is false on insert so AFTER trigger fires notifications
  NEW.notification_sent := false;
  RETURN NEW;
END;
$$;

-- 5. Redefine AFTER trigger function to suppress normal notifications for repeat detections
CREATE OR REPLACE FUNCTION public.process_detection_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_user uuid;
  v_student_user uuid;
  v_admin uuid;
BEGIN
  -- Avoid double notifications
  IF NEW.notification_sent THEN
    RETURN NEW;
  END IF;

  -- If this is a repeat sighting, suppress student/teacher alerts and send EXACTLY ONE alert to admins
  IF NEW.is_repeat = true AND NEW.student_id IS NOT NULL THEN
    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
      VALUES (
        v_admin, NEW.id, 'repeat_detection',
        COALESCE(NEW.student_name, 'Student') || ' detected ' || NEW.repeat_count || ' times in the last 5 minutes.'
      );
    END LOOP;
    
    -- Update parent row directly to set notification_sent = true
    UPDATE public.detections SET notification_sent = true WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Case 1: No ID card → notify admins only
  IF NEW.id_card_found = false THEN
    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
      VALUES (
        v_admin, NEW.id, 'no_id_card',
        CASE WHEN NEW.student_id IS NULL
          THEN 'Unregistered person without ID Card detected.'
          ELSE 'Student without ID Card detected.' END
      );
    END LOOP;
    
    -- Update parent row directly to set notification_sent = true
    UPDATE public.detections SET notification_sent = true WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Case 2: Student recognised → notify student, teacher(s), and admins
  IF NEW.student_id IS NOT NULL THEN
    -- Notify student
    SELECT user_id INTO v_student_user FROM public.students WHERE id = NEW.student_id;
    IF v_student_user IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
      VALUES (
        v_student_user, NEW.id,
        CASE WHEN NEW.color_match IS FALSE THEN 'color_mismatch' ELSE 'entry_verified' END,
        CASE WHEN NEW.color_match IS FALSE
          THEN 'Your ID card color did not match your branch — flagged for review.'
          ELSE 'Your entry was verified.' END
      );
    END IF;

    -- Notify branch teacher(s)
    FOR v_teacher_user IN
      SELECT t.user_id
      FROM public.teachers t
      WHERE t.branch_id = NEW.branch_id AND t.user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
      VALUES (
        v_teacher_user, NEW.id,
        CASE WHEN NEW.color_match IS FALSE THEN 'color_mismatch' ELSE 'branch_entry' END,
        CASE WHEN NEW.color_match IS FALSE
          THEN COALESCE(NEW.student_name, 'A student') || ' entered with mismatched ID color.'
          ELSE COALESCE(NEW.student_name, 'A student') || ' entered and was verified.' END
      );
    END LOOP;

    -- Notify admins
    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
      VALUES (
        v_admin, NEW.id,
        CASE WHEN NEW.color_match IS FALSE THEN 'color_mismatch' ELSE 'branch_entry' END,
        CASE WHEN NEW.color_match IS FALSE
          THEN COALESCE(NEW.student_name, 'A student') || ' — ID color mismatch flagged.'
          ELSE COALESCE(NEW.student_name, 'A student') || ' entry verified.' END
      );
    END LOOP;
  ELSE
    -- Unknown person with an ID
    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
      VALUES (v_admin, NEW.id, 'unknown_student', 'Unregistered person detected.');
    END LOOP;
  END IF;

  -- Update parent row directly to set notification_sent = true
  UPDATE public.detections SET notification_sent = true WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
