CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email TEXT;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.user_roles (user_id, org_id, role) VALUES (auth.uid(), NEW.id, 'admin');
  INSERT INTO public.profiles (org_id, auth_user_id, email, full_name, job_role, status)
  VALUES (NEW.id, auth.uid(), COALESCE(_email, ''), COALESCE(split_part(COALESCE(_email,''), '@', 1), 'Admin'), 'Administrator', 'active');
  INSERT INTO public.audit_logs (org_id, actor_id, actor_email, action, entity_type, entity_id)
  VALUES (NEW.id, auth.uid(), COALESCE(_email, ''), 'organization.created', 'organization', NEW.id::text);
  INSERT INTO public.monitoring_schedules (org_id, day_of_week, enabled, start_time, end_time, timezone)
  SELECT NEW.id, d, d BETWEEN 1 AND 5, '09:00'::time, '18:00'::time, NEW.timezone FROM generate_series(0, 6) AS d;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID, UUID) TO authenticated;