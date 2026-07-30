
CREATE OR REPLACE FUNCTION public.get_teacher_branch(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.teachers WHERE user_id = _user_id LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_teacher_branch(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_teacher_branch(uuid) TO authenticated;

DROP POLICY IF EXISTS "Student views self" ON public.students;
CREATE POLICY "Students visible by scope" ON public.students
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'teacher'::app_role)
    AND branch_id IS NOT NULL
    AND branch_id = public.get_teacher_branch(auth.uid())
  )
);

DROP POLICY IF EXISTS "Detections read scope" ON public.detections;
CREATE POLICY "Detections read scope" ON public.detections
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'teacher'::app_role)
    AND branch_id IS NOT NULL
    AND branch_id = public.get_teacher_branch(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = detections.student_id AND s.user_id = auth.uid()
  )
);
