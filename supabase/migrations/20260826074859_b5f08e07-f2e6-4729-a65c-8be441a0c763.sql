REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM anon, authenticated;