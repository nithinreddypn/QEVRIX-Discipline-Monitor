
-- Users can upload/replace/delete files in student-photos where the top-level folder is their own user id.
DROP POLICY IF EXISTS "student_photos_own_write" ON storage.objects;
CREATE POLICY "student_photos_own_write" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'student-photos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'student-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Any authenticated user can read student photos (teachers/admins need to see them; students see their own)
DROP POLICY IF EXISTS "student_photos_read_all" ON storage.objects;
CREATE POLICY "student_photos_read_all" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'student-photos');
