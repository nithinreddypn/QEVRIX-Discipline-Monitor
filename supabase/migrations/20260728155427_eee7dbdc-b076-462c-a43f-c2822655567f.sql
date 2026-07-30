
CREATE TABLE IF NOT EXISTS public.system_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  ai_confidence_threshold numeric NOT NULL DEFAULT 0.75 CHECK (ai_confidence_threshold >= 0 AND ai_confidence_threshold <= 1),
  notify_teacher_missing_id boolean NOT NULL DEFAULT true,
  notify_teacher_unknown boolean NOT NULL DEFAULT true,
  notify_teacher_late_entry boolean NOT NULL DEFAULT false,
  notify_admin_missing_id boolean NOT NULL DEFAULT false,
  notify_admin_unknown boolean NOT NULL DEFAULT true,
  notify_student_verified boolean NOT NULL DEFAULT true,
  notify_student_flagged boolean NOT NULL DEFAULT true,
  system_name text NOT NULL DEFAULT 'QEVRIX Discipline Monitor',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage system settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "All staff read system settings" ON public.system_settings
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'teacher')
  );

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.system_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
