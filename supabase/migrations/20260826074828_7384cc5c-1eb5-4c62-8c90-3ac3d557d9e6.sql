CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  heartbeat_interval_seconds INT NOT NULL DEFAULT 300,
  data_retention_days INT NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (org_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  auth_user_id UUID UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  job_role TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, org_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND org_id = _org_id AND role = 'admin'
  )
$$;

CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'expired', 'revoked')),
  invited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.monitoring_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  enabled BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_schedules TO authenticated;
GRANT ALL ON public.monitoring_schedules TO service_role;
ALTER TABLE public.monitoring_schedules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  os TEXT NOT NULL,
  agent_version TEXT NOT NULL DEFAULT '1.2.4',
  device_key_hash TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  monitoring_state TEXT NOT NULL DEFAULT 'off_shift' CHECK (monitoring_state IN ('active', 'off_shift', 'paused', 'offline')),
  last_heartbeat_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.activity_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  process_name TEXT,
  window_title TEXT,
  category TEXT NOT NULL DEFAULT 'neutral' CHECK (category IN ('productive', 'neutral', 'distracted')),
  is_idle BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL,
  duration_seconds INT NOT NULL CHECK (duration_seconds >= 0),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_sessions TO authenticated;
GRANT ALL ON public.activity_sessions TO service_role;
ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX activity_sessions_org_started_idx ON public.activity_sessions (org_id, started_at);
CREATE INDEX activity_sessions_profile_date_idx ON public.activity_sessions (profile_id, started_at);

CREATE TABLE public.daily_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  productive_seconds INT NOT NULL DEFAULT 0,
  neutral_seconds INT NOT NULL DEFAULT 0,
  distracted_seconds INT NOT NULL DEFAULT 0,
  idle_seconds INT NOT NULL DEFAULT 0,
  focus_seconds INT NOT NULL DEFAULT 0,
  focus_score NUMERIC(5,1) NOT NULL DEFAULT 0,
  context_switches INT NOT NULL DEFAULT 0,
  productivity_score NUMERIC(5,1) NOT NULL DEFAULT 0,
  UNIQUE (profile_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_summaries TO authenticated;
GRANT ALL ON public.daily_summaries TO service_role;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE INDEX daily_summaries_org_date_idx ON public.daily_summaries (org_id, date);

CREATE TABLE public.ai_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL DEFAULT 'daily' CHECK (report_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  summary TEXT NOT NULL,
  strengths JSONB NOT NULL DEFAULT '[]',
  concerns JSONB NOT NULL DEFAULT '[]',
  patterns JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_reports TO authenticated;
GRANT ALL ON public.ai_reports TO service_role;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('productivity_score', 'focus_score', 'focus_hours', 'distracted_ratio')),
  target_value NUMERIC NOT NULL,
  period TEXT NOT NULL DEFAULT 'weekly' CHECK (period IN ('daily', 'weekly', 'monthly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX audit_logs_org_created_idx ON public.audit_logs (org_id, created_at DESC);

CREATE POLICY "admins read own org" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_admin(auth.uid(), id));
CREATE POLICY "admins update own org" ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_admin(auth.uid(), id));
CREATE POLICY "anyone can create org on onboarding" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "org admins manage departments" ON public.departments FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins manage roles in org" ON public.user_roles FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins manage invitations" ON public.invitations FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins manage schedules" ON public.monitoring_schedules FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins manage devices" ON public.devices FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins read activity" ON public.activity_sessions FOR SELECT TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins insert activity" ON public.activity_sessions FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins manage summaries" ON public.daily_summaries FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins manage ai reports" ON public.ai_reports FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins manage goals" ON public.goals FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "org admins write audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(auth.uid(), org_id));

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
  SELECT NEW.id, d, d BETWEEN 1 AND 5, '09:00', '18:00', NEW.timezone FROM generate_series(0, 6) AS d;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();