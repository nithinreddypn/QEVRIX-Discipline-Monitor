
-- Helper: hex distance for color match tolerance
CREATE OR REPLACE FUNCTION public.hex_color_close(a text, b text, tolerance int DEFAULT 60)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  ar int; ag int; ab int;
  br int; bg int; bb int;
  ax text; bx text;
BEGIN
  IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
  ax := lower(regexp_replace(a, '^#', ''));
  bx := lower(regexp_replace(b, '^#', ''));
  IF length(ax) <> 6 OR length(bx) <> 6 THEN RETURN NULL; END IF;
  ar := ('x' || substr(ax,1,2))::bit(8)::int;
  ag := ('x' || substr(ax,3,2))::bit(8)::int;
  ab := ('x' || substr(ax,5,2))::bit(8)::int;
  br := ('x' || substr(bx,1,2))::bit(8)::int;
  bg := ('x' || substr(bx,3,2))::bit(8)::int;
  bb := ('x' || substr(bx,5,2))::bit(8)::int;
  RETURN sqrt(power(ar-br,2) + power(ag-bg,2) + power(ab-bb,2)) <= tolerance;
END;
$$;

-- Main trigger: compute verification + emit notifications
CREATE OR REPLACE FUNCTION public.process_detection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_color text;
  v_match boolean;
  v_teacher_user uuid;
  v_student_user uuid;
  v_admin uuid;
BEGIN
  -- Only act once per detection
  IF NEW.notification_sent THEN
    RETURN NEW;
  END IF;

  -- Case 1: No ID card → notify admins only
  IF NEW.id_card_found = false THEN
    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
      VALUES (v_admin, NEW.id, 'no_id_card', 'Student without ID Card detected.');
    END LOOP;

    NEW.status := COALESCE(NEW.status, 'flagged');
    NEW.notification_sent := true;
    RETURN NEW;
  END IF;

  -- Case 2: Student recognised → verify color, notify student/teacher/admin
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
          THEN COALESCE(NEW.student_name,'A student') || ' entered with mismatched ID color.'
          ELSE COALESCE(NEW.student_name,'A student') || ' entered and was verified.' END
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
          THEN COALESCE(NEW.student_name,'A student') || ' — ID color mismatch flagged.'
          ELSE COALESCE(NEW.student_name,'A student') || ' entry verified.' END
      );
    END LOOP;
  ELSE
    -- Unknown person with an ID
    NEW.status := COALESCE(NEW.status, 'unknown');
    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
      VALUES (v_admin, NEW.id, 'unknown_student', 'Unknown person detected.');
    END LOOP;
  END IF;

  NEW.notification_sent := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_detection ON public.detections;
CREATE TRIGGER trg_process_detection
BEFORE INSERT ON public.detections
FOR EACH ROW EXECUTE FUNCTION public.process_detection();
