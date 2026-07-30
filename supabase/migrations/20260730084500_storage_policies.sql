-- Disable student self-upload/modification of profile photos
DROP POLICY IF EXISTS "student_photos_own_write" ON storage.objects;
DROP POLICY IF EXISTS "student_photos_staff_write" ON storage.objects;

-- Allow only teachers and admins to write (insert/update/delete) in student-photos
CREATE POLICY "student_photos_staff_write" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'student-photos'
  AND (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- Policies for the new teacher-photos bucket
DROP POLICY IF EXISTS "teacher_photos_read_all" ON storage.objects;
CREATE POLICY "teacher_photos_read_all" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'teacher-photos');

DROP POLICY IF EXISTS "teacher_photos_own_write" ON storage.objects;
CREATE POLICY "teacher_photos_own_write" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'teacher-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'teacher-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
