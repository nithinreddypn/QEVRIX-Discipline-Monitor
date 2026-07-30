
-- 1. Add status to students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','active','rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Existing rows should stay active (they were seeded pre-approval flow)
UPDATE public.students SET status = 'active' WHERE created_at < now() - interval '1 minute';

-- Allow students to read their own row
DROP POLICY IF EXISTS "Students can view own row" ON public.students;
CREATE POLICY "Students can view own row"
ON public.students FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Allow teachers to update status/rejection_reason for students in their branch
DROP POLICY IF EXISTS "Teachers can update students in their branch" ON public.students;
CREATE POLICY "Teachers can update students in their branch"
ON public.students FOR UPDATE TO authenticated
USING (branch_id = public.get_teacher_branch(auth.uid()))
WITH CHECK (branch_id = public.get_teacher_branch(auth.uid()));

-- Allow authenticated users (student themselves) to insert their own student row at signup
DROP POLICY IF EXISTS "Users can create their own student profile" ON public.students;
CREATE POLICY "Users can create their own student profile"
ON public.students FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 2. Trigger: notify branch teacher(s) when a student signs up (pending_approval)
CREATE OR REPLACE FUNCTION public.notify_teacher_on_new_student()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
BEGIN
  IF NEW.status = 'pending_approval' AND NEW.branch_id IS NOT NULL THEN
    FOR t IN
      SELECT user_id FROM public.teachers
      WHERE branch_id = NEW.branch_id AND user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (recipient_user_id, type, message)
      VALUES (
        t.user_id,
        'pending_approval',
        'New student signup awaiting approval: ' || NEW.full_name || ', ' || NEW.usn
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_teacher_on_new_student ON public.students;
CREATE TRIGGER trg_notify_teacher_on_new_student
AFTER INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.notify_teacher_on_new_student();

-- 3. Trigger: notify student on approval / rejection
CREATE OR REPLACE FUNCTION public.notify_student_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'active' THEN
      INSERT INTO public.notifications (recipient_user_id, type, message)
      VALUES (NEW.user_id, 'approved', 'Your profile has been approved. Welcome to QEVRIX.');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (recipient_user_id, type, message)
      VALUES (
        NEW.user_id,
        'rejected',
        COALESCE('Your signup was rejected: ' || NULLIF(NEW.rejection_reason, ''), 'Your signup was rejected. Please contact the admin.')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_on_status_change ON public.students;
CREATE TRIGGER trg_notify_student_on_status_change
AFTER UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.notify_student_on_status_change();

-- 4. user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  default_landing text,
  notification_channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own preferences" ON public.user_preferences;
CREATE POLICY "Own preferences" ON public.user_preferences
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_user_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_user_preferences ON public.user_preferences;
CREATE TRIGGER trg_touch_user_preferences
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.touch_user_preferences_updated_at();
