-- Policies for the new esp32-detections bucket

-- Allow authenticated admins/teachers to select (read) files in esp32-detections
DROP POLICY IF EXISTS "esp32_detections_read" ON storage.objects;
CREATE POLICY "esp32_detections_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'esp32-detections'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'teacher'::public.app_role)
  )
);

-- Allow authenticated admins/teachers to insert (write) files in esp32-detections
DROP POLICY IF EXISTS "esp32_detections_write" ON storage.objects;
CREATE POLICY "esp32_detections_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'esp32-detections'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'teacher'::public.app_role)
  )
);

-- Allow authenticated admins/teachers to delete files in esp32-detections
DROP POLICY IF EXISTS "esp32_detections_delete" ON storage.objects;
CREATE POLICY "esp32_detections_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'esp32-detections'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'teacher'::public.app_role)
  )
);
