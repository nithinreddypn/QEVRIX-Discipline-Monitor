-- Create student_embeddings table to persist face embeddings
CREATE TABLE IF NOT EXISTS public.student_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  embedding double precision[] NOT NULL,
  model_version text NOT NULL, -- Format: 'resnet18:path/to/photo.jpg'
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_student_embedding UNIQUE (student_id)
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.student_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage student embeddings
CREATE POLICY "student_embeddings_all_policy" ON public.student_embeddings
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
