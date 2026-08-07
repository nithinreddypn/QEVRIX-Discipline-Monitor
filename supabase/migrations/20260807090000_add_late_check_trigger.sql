-- Redefine AFTER trigger function to execute the updated decision tree rules including late check
CREATE OR REPLACE FUNCTION public.process_detection_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_user uuid;
  v_admin uuid;
  v_student_branch_id uuid;
  v_student_display_name text;
  v_message text;
  v_best_branch_id uuid;
  v_best_branch_name text;
  v_local_time time;
  v_is_late boolean;
BEGIN
  -- Avoid double notifications
  IF NEW.notification_sent THEN
    RETURN NEW;
  END IF;

  -- Repeat window sighting check (from Phase G)
  IF NEW.is_repeat = true AND NEW.student_id IS NOT NULL THEN
    -- Look up name for repeat message
    SELECT COALESCE(full_name, NEW.student_name, 'Student') INTO v_student_display_name
    FROM public.students WHERE id = NEW.student_id;

    FOR v_admin IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' AND user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
      VALUES (
        v_admin, NEW.id, 'repeat_detection',
        v_student_display_name || ' detected ' || NEW.repeat_count || ' times in the last 5 minutes.'
      );
    END LOOP;
    
    UPDATE public.detections SET notification_sent = true WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Convert UTC detection_time to IST (UTC+5:30) and check if late (after 09:00:00)
  v_local_time := (NEW.detection_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::time;
  v_is_late := v_local_time > '09:00:00'::time;

  -- CASE 1 & CASE 2: Recognized student (student is already present)
  IF NEW.student_id IS NOT NULL THEN
    -- Get branch ID and full name from student's details
    SELECT branch_id, COALESCE(full_name, NEW.student_name, 'Student')
    INTO v_student_branch_id, v_student_display_name
    FROM public.students WHERE id = NEW.student_id;
    
    IF NEW.branch_id IS NOT NULL THEN
      v_student_branch_id := NEW.branch_id;
    END IF;

    IF NEW.id_card_found = true THEN
      -- CASE 1: Recognized student, ID card found
      IF NEW.color_match = true THEN
        IF v_is_late THEN
          v_message := v_student_display_name || ' detected late (after 9:00 AM) — ID verified';
        ELSE
          v_message := v_student_display_name || ' detected — ID verified';
        END IF;
      ELSE
        IF v_is_late THEN
          v_message := v_student_display_name || ' detected late (after 9:00 AM) — ID color mismatch, flagged for review';
        ELSE
          v_message := v_student_display_name || ' detected — ID color mismatch, flagged for review';
        END IF;
      END IF;
    ELSE
      -- CASE 2: Recognized student, ID card NOT found
      IF v_is_late THEN
        v_message := v_student_display_name || ' detected late (after 9:00 AM) without ID card';
      ELSE
        v_message := v_student_display_name || ' detected without ID card';
      END IF;
    END IF;

    -- Notify BOTH admin and that branch's teacher based on the student's details
    -- 1. Admins
    FOR v_admin IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' AND user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
      VALUES (v_admin, NEW.id, 'recognized_sighting', v_message);
    END LOOP;

    -- 2. Teachers of that branch (only notify when student is recognized/present)
    IF v_student_branch_id IS NOT NULL THEN
      FOR v_teacher_user IN
        SELECT DISTINCT user_id FROM public.teachers WHERE branch_id = v_student_branch_id AND user_id IS NOT NULL
      LOOP
        INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
        VALUES (v_teacher_user, NEW.id, 'recognized_sighting', v_message);
      END LOOP;
    END IF;

  -- CASE 3 & CASE 4: Unrecognized/unknown person (student is NOT present)
  ELSE
    v_best_branch_id := NULL;
    v_best_branch_name := NULL;

    -- Match color to find branch
    IF NEW.id_card_found = true AND NEW.id_card_color IS NOT NULL THEN
      SELECT id, name
      INTO v_best_branch_id, v_best_branch_name
      FROM public.branches
      WHERE public.hex_color_close(NEW.id_card_color, color_hex, 60)
      LIMIT 1;
    END IF;

    IF NEW.id_card_found = true AND v_best_branch_id IS NOT NULL THEN
      -- CASE 4: Unrecognized person, ID card found (matching known branch color)
      IF v_is_late THEN
        v_message := 'Unrecognized person wearing a ' || v_best_branch_name || ' ID detected late (after 9:00 AM) — please verify';
      ELSE
        v_message := 'Unrecognized person wearing a ' || v_best_branch_name || ' ID detected — please verify';
      END IF;

      -- Notify ADMIN ONLY (don't notify any teachers, since student is not present)
      FOR v_admin IN
        SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' AND user_id IS NOT NULL
      LOOP
        INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
        VALUES (v_admin, NEW.id, 'unknown_sighting', v_message);
      END LOOP;
    ELSE
      -- CASE 3: Unrecognized person, ID card NOT found (or invalid branch color fallback)
      IF v_is_late THEN
        v_message := 'Unknown person detected late (after 9:00 AM) without ID card';
      ELSE
        v_message := 'Unknown person detected without ID card';
      END IF;

      -- Notify ADMIN ONLY
      FOR v_admin IN
        SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'admin' AND user_id IS NOT NULL
      LOOP
        INSERT INTO public.notifications (recipient_user_id, detection_id, type, message)
        VALUES (v_admin, NEW.id, 'unknown_sighting', v_message);
      END LOOP;
    END IF;
  END IF;

  -- Mark notification sent on the row
  UPDATE public.detections SET notification_sent = true WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
