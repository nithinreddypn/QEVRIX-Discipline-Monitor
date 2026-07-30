-- Fix esp32-detections storage read policy to permit students to view their own detection photos
DROP POLICY IF EXISTS "esp32_detections_read" ON storage.objects;

CREATE POLICY "esp32_detections_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'esp32-detections'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'teacher'::public.app_role)
    -- Student can view their own detection images
    OR EXISTS (
      SELECT 1 FROM public.detections d
      JOIN public.students s ON d.student_id = s.id
      WHERE d.image_url = 'esp32-detections/' || name
        AND s.user_id = auth.uid()
    )
  )
);
