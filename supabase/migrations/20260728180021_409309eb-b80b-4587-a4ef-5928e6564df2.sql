
DROP POLICY IF EXISTS "Students update own row" ON public.students;
CREATE POLICY "Students update own row"
ON public.students
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
