
-- Create demo users for each role
DO $$
DECLARE
  s_id uuid := gen_random_uuid();
  t_id uuid := gen_random_uuid();
  a_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email='student@demo.qevrix.app') THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', s_id, 'authenticated','authenticated','student@demo.qevrix.app', crypt('Demo123!',gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Demo Student"}', now(), now(),'','','','');
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), s_id, jsonb_build_object('sub',s_id::text,'email','student@demo.qevrix.app'),'email',s_id::text,now(),now(),now());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email='teacher@demo.qevrix.app') THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', t_id, 'authenticated','authenticated','teacher@demo.qevrix.app', crypt('Demo123!',gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Demo Teacher"}', now(), now(),'','','','');
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), t_id, jsonb_build_object('sub',t_id::text,'email','teacher@demo.qevrix.app'),'email',t_id::text,now(),now(),now());
    INSERT INTO public.user_roles (user_id, role) VALUES (t_id,'teacher') ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email='admin@demo.qevrix.app') THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', a_id, 'authenticated','authenticated','admin@demo.qevrix.app', crypt('Demo123!',gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Demo Admin"}', now(), now(),'','','','');
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), a_id, jsonb_build_object('sub',a_id::text,'email','admin@demo.qevrix.app'),'email',a_id::text,now(),now(),now());
    INSERT INTO public.user_roles (user_id, role) VALUES (a_id,'admin') ON CONFLICT DO NOTHING;
  END IF;
END $$;
