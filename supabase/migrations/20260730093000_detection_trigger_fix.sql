-- Split detection trigger to fix foreign key constraint violations during insert

-- 1. Create BEFORE trigger function for validation and status matching
CREATE OR REPLACE FUNCTION public.process_detection_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_color text;
  v_match boolean;
BEGIN
  -- If student recognized, verify color
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
      NEW.status := COALESCE(NEW.status, 'flagged'); -- Unknown person with ID is flagged
    END IF;
  END IF;

  -- Ensure notification_sent is false on insert so AFTER trigger fires notifications
  NEW.notification_sent := false;
  RETURN NEW;
END;
$$;

-- 2. Create AFTER trigger function to insert child notifications referencing committed row ID
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

-- 3. Drop existing trigger definitions and bind the new functions
DROP TRIGGER IF EXISTS trg_process_detection ON public.detections;

DROP TRIGGER IF EXISTS trg_process_detection_before ON public.detections;
CREATE TRIGGER trg_process_detection_before
BEFORE INSERT ON public.detections
FOR EACH ROW EXECUTE FUNCTION public.process_detection_before();

DROP TRIGGER IF EXISTS trg_process_detection_after ON public.detections;
CREATE TRIGGER trg_process_detection_after
AFTER INSERT ON public.detections
FOR EACH ROW EXECUTE FUNCTION public.process_detection_after();
