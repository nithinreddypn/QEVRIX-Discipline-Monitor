
DROP POLICY IF EXISTS student_photos_read_all ON storage.objects;
DROP POLICY IF EXISTS student_photos_read_scoped ON storage.objects;

CREATE POLICY student_photos_read_scoped
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (
    -- Owner can view own file
    (auth.uid())::text = (storage.foldername(name))[1]
    -- Admins can view all
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    -- A teacher can view a student's photo when that student is in the teacher's branch
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id::text = (storage.foldername(name))[1]
        AND public.has_role(auth.uid(), 'teacher'::public.app_role)
        AND s.branch_id IS NOT NULL
        AND s.branch_id = public.get_teacher_branch(auth.uid())
    )
  )
);
