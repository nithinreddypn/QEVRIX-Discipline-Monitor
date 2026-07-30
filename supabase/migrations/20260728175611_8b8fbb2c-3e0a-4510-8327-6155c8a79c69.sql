
-- 1) Extend teachers table
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Existing rows stay active. New self-signups will be pending_approval.

-- 2) Allow a teacher to update their own row (name/phone/photo).
DROP POLICY IF EXISTS "Teachers update own row" ON public.teachers;
CREATE POLICY "Teachers update own row"
ON public.teachers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow a teacher to insert their own row during self-signup (trigger uses SECURITY DEFINER anyway, but this keeps client-side inserts consistent).
DROP POLICY IF EXISTS "Teachers insert own row" ON public.teachers;
CREATE POLICY "Teachers insert own row"
ON public.teachers
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3) Update handle_new_user to also create a pending teacher record when role='teacher'
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_branch uuid;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  );

  v_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'student'::public.app_role);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  IF v_role = 'teacher' THEN
    v_branch := NULLIF(NEW.raw_user_meta_data ->> 'branch_id', '')::uuid;
    INSERT INTO public.teachers (user_id, full_name, email, phone, branch_id, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
      NEW.email,
      NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
      v_branch,
      'pending_approval'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Trigger: notify admins when a teacher row is inserted with pending_approval
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_teacher()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid;
BEGIN
  IF NEW.status = 'pending_approval' THEN
    FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (recipient_user_id, type, message)
      VALUES (
        v_admin,
        'teacher_pending_approval',
        'New teacher signup awaiting approval: ' || COALESCE(NEW.full_name, NEW.email)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_new_teacher ON public.teachers;
CREATE TRIGGER trg_notify_admin_on_new_teacher
AFTER INSERT ON public.teachers
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_new_teacher();

-- 5) Trigger: notify teacher when admin changes their status
CREATE OR REPLACE FUNCTION public.notify_teacher_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'active' THEN
      INSERT INTO public.notifications (recipient_user_id, type, message)
      VALUES (NEW.user_id, 'approved', 'Your teacher account has been approved. Welcome to QEVRIX.');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (recipient_user_id, type, message)
      VALUES (
        NEW.user_id,
        'rejected',
        COALESCE('Your teacher signup was rejected: ' || NULLIF(NEW.rejection_reason, ''), 'Your teacher signup was rejected. Please contact the admin.')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_teacher_on_status_change ON public.teachers;
CREATE TRIGGER trg_notify_teacher_on_status_change
AFTER UPDATE ON public.teachers
FOR EACH ROW EXECUTE FUNCTION public.notify_teacher_on_status_change();
