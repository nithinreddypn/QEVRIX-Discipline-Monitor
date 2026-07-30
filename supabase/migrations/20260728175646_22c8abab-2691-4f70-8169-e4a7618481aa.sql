
REVOKE ALL ON FUNCTION public.notify_admin_on_new_teacher() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_teacher_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
