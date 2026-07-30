
-- Enum for app roles
CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'admin');

-- =========================
-- PROFILES (user profile mirror of auth.users)
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================
-- USER ROLES (separate for security)
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profile policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile & default 'student' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'student'::public.app_role)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- BRANCHES
-- =========================
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  color_hex TEXT NOT NULL,
  color_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read branches" ON public.branches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage branches" ON public.branches
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- STUDENTS
-- =========================
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usn TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  semester INT,
  profile_photo_url TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student views self" ON public.students
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'teacher')
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins manage students" ON public.students
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- TEACHERS
-- =========================
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher views self or peers" ON public.teachers
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'teacher')
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins manage teachers" ON public.teachers
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- DETECTIONS
-- =========================
CREATE TABLE public.detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  student_name TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  image_url TEXT,
  id_card_found BOOLEAN NOT NULL DEFAULT false,
  id_card_color TEXT,
  expected_branch_color TEXT,
  color_match BOOLEAN,
  detection_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence NUMERIC,
  status TEXT,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.detections TO authenticated;
GRANT ALL ON public.detections TO service_role;
ALTER TABLE public.detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Detections read scope" ON public.detections
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'teacher')
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = detections.student_id AND s.user_id = auth.uid()
    )
  );
CREATE POLICY "Staff manage detections" ON public.detections
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
  );

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  detection_id UUID REFERENCES public.detections(id) ON DELETE SET NULL,
  type TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipient reads notifications" ON public.notifications
  FOR SELECT TO authenticated USING (
    recipient_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Recipient updates own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());
CREATE POLICY "Staff manage notifications" ON public.notifications
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
  );
