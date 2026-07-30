
ALTER FUNCTION public.touch_user_preferences_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.notify_teacher_on_new_student() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_student_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_user_preferences_updated_at() FROM PUBLIC, anon, authenticated;
