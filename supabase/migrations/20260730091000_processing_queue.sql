-- Create processing_queue table for crash-resilient background processing
CREATE TABLE IF NOT EXISTS public.processing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_path text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (like python backend/admins) to read/write to the queue
CREATE POLICY "processing_queue_all_policy" ON public.processing_queue
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
