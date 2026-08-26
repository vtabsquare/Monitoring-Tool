CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email TEXT;
  _eng UUID; _des UUID; _mkt UUID; _ops UUID;
  _p UUID;
  _users UUID[] := '{}';
  _devices UUID[] := '{}';
  _names TEXT[][] := ARRAY[
    ['Sarah Miller','sarah.miller@example.com','Senior Developer'],
    ['Marcus Chen','marcus.chen@example.com','Lead UI Designer'],
    ['Elena Ricci','elena.ricci@example.com','Content Strategist'],
    ['David Okafor','david.okafor@example.com','Backend Engineer'],
    ['Priya Nair','priya.nair@example.com','QA Engineer'],
    ['Tom Alvarez','tom.alvarez@example.com','DevOps Engineer'],
    ['Hana Sato','hana.sato@example.com','Marketing Manager']
  ];
  _depts UUID[];
  _dev_names TEXT[] := ARRAY['WS-2940','DESKTOP-829','WS-9001','WS-3102','WS-4471'];
  _dev_os TEXT[] := ARRAY['Windows 11 Pro x64','Windows 10 Pro x64','Windows 11 Pro x64','Windows 11 Pro x64','Windows 10 Enterprise x64'];
  _dev_states TEXT[] := ARRAY['active','active','offline','active','off_shift'];
  _dev_versions TEXT[] := ARRAY['1.2.4','1.2.4','1.2.2','1.2.4','1.2.3'];
  _d DATE;
  _i INT;
  _u INT;
  _prod INT; _neut INT; _dist INT; _idle INT; _focus INT; _fs NUMERIC; _cs INT; _ps NUMERIC;
  _apps TEXT[][] := ARRAY[
    ['Visual Studio Code','Code.exe','productive'],
    ['Google Chrome','chrome.exe','neutral'],
    ['Slack','Slack.exe','neutral'],
    ['Figma','Figma.exe','productive'],
    ['Linear','Linear.exe','productive'],
    ['Microsoft Outlook','OUTLOOK.EXE','neutral'],
    ['YouTube','chrome.exe','distracted'],
    ['Twitter / X','chrome.exe','distracted'],
    ['Notion','Notion.exe','productive'],
    ['Windows Explorer','explorer.exe','neutral']
  ];
  _hour INT;
  _app INT[];
  _title TEXT;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.user_roles (user_id, org_id, role) VALUES (auth.uid(), NEW.id, 'admin');
  INSERT INTO public.profiles (org_id, auth_user_id, email, full_name, job_role, status)
  VALUES (NEW.id, auth.uid(), COALESCE(_email, ''), COALESCE(split_part(COALESCE(_email,''), '@', 1), 'Admin'), 'Administrator', 'active');
  INSERT INTO public.audit_logs (org_id, actor_id, actor_email, action, entity_type, entity_id)
  VALUES (NEW.id, auth.uid(), COALESCE(_email, ''), 'organization.created', 'organization', NEW.id::text);

  -- Departments
  INSERT INTO public.departments (org_id, name) VALUES (NEW.id, 'Engineering') RETURNING id INTO _eng;
  INSERT INTO public.departments (org_id, name) VALUES (NEW.id, 'Design') RETURNING id INTO _des;
  INSERT INTO public.departments (org_id, name) VALUES (NEW.id, 'Marketing') RETURNING id INTO _mkt;
  INSERT INTO public.departments (org_id, name) VALUES (NEW.id, 'Operations') RETURNING id INTO _ops;
  _depts := ARRAY[_eng, _des, _mkt, _eng, _eng, _ops, _mkt];

  -- Org default schedule: Mon-Fri 09:00-18:00, weekend OFF
  INSERT INTO public.monitoring_schedules (org_id, day_of_week, enabled, start_time, end_time, timezone)
  SELECT NEW.id, d, d BETWEEN 1 AND 5, '09:00', '18:00', NEW.timezone FROM generate_series(0, 6) AS d;

  -- Demo users + invitations
  FOR _i IN 1..7 LOOP
    INSERT INTO public.profiles (org_id, department_id, email, full_name, job_role, status)
    VALUES (NEW.id, _depts[_i], _names[_i][2], _names[_i][1], _names[_i][3], CASE WHEN _i <= 5 THEN 'active' ELSE 'invited' END)
    RETURNING id INTO _p;
    _users := array_append(_users, _p);
    INSERT INTO public.invitations (org_id, profile_id, email, status)
    VALUES (NEW.id, _p, _names[_i][2], CASE WHEN _i <= 5 THEN 'accepted' ELSE 'sent' END);
    -- Per-user schedule mirrors org default (one overrides to earlier start)
    INSERT INTO public.monitoring_schedules (org_id, profile_id, day_of_week, enabled, start_time, end_time, timezone)
    SELECT NEW.id, _p, d, d BETWEEN 1 AND 5, CASE WHEN _i = 6 THEN '08:00' ELSE '09:00' END, CASE WHEN _i = 6 THEN '16:00' ELSE '18:00' END, NEW.timezone
    FROM generate_series(0, 6) AS d;
  END LOOP;

  -- Devices for first 5 users
  FOR _i IN 1..5 LOOP
    INSERT INTO public.devices (org_id, profile_id, name, os, agent_version, device_key_hash, status, monitoring_state, last_heartbeat_at, last_sync_at, registered_at)
    VALUES (
      NEW.id, _users[_i], _dev_names[_i], _dev_os[_i], _dev_versions[_i],
      encode(digest('demo-device-key-' || _i::text, 'sha256'), 'hex'),
      CASE WHEN _dev_states[_i] = 'offline' THEN 'active' ELSE 'active' END,
      _dev_states[_i],
      CASE WHEN _dev_states[_i] = 'offline' THEN now() - interval '18 hours' ELSE now() - ((_i * 37) || ' seconds')::interval END,
      CASE WHEN _dev_states[_i] = 'offline' THEN now() - interval '18 hours' ELSE now() - ((_i * 61) || ' seconds')::interval END,
      now() - interval '21 days'
    ) RETURNING id INTO _p;
    _devices := array_append(_devices, _p);
  END LOOP;

  -- 14 days of daily summaries + activity sessions for the 5 device users
  FOR _d IN SELECT generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day'::interval)::date LOOP
    CONTINUE WHEN extract(isodow FROM _d) > 5; -- weekends off
    FOR _u IN 1..5 LOOP
      _prod := 15000 + ((extract(epoch FROM _d)::bigint + _u * 7919) % 9000)::int;
      _neut := 4000 + ((_u * 104729 + extract(doy FROM _d)::int * 137) % 3600)::int;
      _dist := 1200 + ((_u * 15485863 + extract(doy FROM _d)::int * 31) % 2400)::int;
      _idle := 1800 + ((_u * 32452843 + extract(doy FROM _d)::int * 17) % 1800)::int;
      _focus := 3600 + ((_u * 49979687 + extract(doy FROM _d)::int * 7) % 7200)::int;
      _cs := 40 + ((_u * 15485867 + extract(doy FROM _d)::int) % 120)::int;
      _fs := ROUND(((_prod::numeric / (_prod + _neut + _dist)) * 60 + LEAST(_focus, 9000)::numeric / 9000 * 40)::numeric, 1);
      _ps := ROUND(((_prod::numeric * 1.0 + _neut::numeric * 0.5 - _dist::numeric * 0.5) / (_prod + _neut + _dist) * 100)::numeric, 1);
      _ps := GREATEST(0, LEAST(100, _ps));
      INSERT INTO public.daily_summaries (org_id, profile_id, date, productive_seconds, neutral_seconds, distracted_seconds, idle_seconds, focus_seconds, focus_score, context_switches, productivity_score)
      VALUES (NEW.id, _users[_u], _d, _prod, _neut, _dist, _idle, _focus, GREATEST(0, LEAST(100, _fs)), _cs, _ps);

      -- ~10 activity sessions per user per monitored day, 09:00-18:00 window
      FOR _i IN 1..10 LOOP
        _app := ((_u * 31 + _i * 13 + extract(doy FROM _d)::int) % 10) + 1;
        _hour := 9 + ((_i * 53 + _u * 7) % 8);
        _title := CASE _apps[_app][1]
          WHEN 'Visual Studio Code' THEN 'main.ts - project-core'
          WHEN 'Google Chrome' THEN 'Documentation - MDN Web Docs'
          WHEN 'Slack' THEN '#engineering - Slack'
          WHEN 'Figma' THEN 'Dashboard v3 - Figma'
          WHEN 'Linear' THEN 'SPR-142: Sync latency'
          WHEN 'Microsoft Outlook' THEN 'Inbox - Outlook'
          WHEN 'YouTube' THEN 'YouTube - Home'
          WHEN 'Twitter / X' THEN 'X / Home'
          WHEN 'Notion' THEN 'Sprint Plan - Notion'
          ELSE 'File Explorer' END;
        INSERT INTO public.activity_sessions (org_id, profile_id, device_id, app_name, process_name, window_title, category, is_idle, started_at, duration_seconds)
        VALUES (
          NEW.id, _users[_u], _devices[_u], _apps[_app][1], _apps[_app][2], _title, _apps[_app][3],
          _i = 10,
          (_d::timestamp + make_interval(hours => _hour, mins => (_i * 17) % 55)) AT TIME ZONE NEW.timezone,
          600 + ((_u * 2654435761 + _i * 40503 + extract(doy FROM _d)::int * 97) % 3000)::int
        );
      END LOOP;
    END LOOP;
  END LOOP;

  -- AI report (org-wide, weekly)
  INSERT INTO public.ai_reports (org_id, profile_id, report_type, period_start, period_end, summary, strengths, concerns, patterns, recommendations, confidence, model)
  VALUES (
    NEW.id, NULL, 'weekly', CURRENT_DATE - 7, CURRENT_DATE - 1,
    'The organization is exhibiting a high-density focus pattern. Peak productivity occurred between 10:00 and 11:30 local time. Behavioral patterns suggest a correlation between decreased idle time and the recent sprint launch.',
    '["Sustained deep-work blocks in Engineering", "Minimal context switching before 14:00", "High usage of specialized tools over general browsing"]'::jsonb,
    '["Rising neutral time in the Marketing pod", "Heartbeat latency on one remote workstation", "Cluster of idle sessions around mid-shift"]'::jsonb,
    '["Focus peaks 10:00-11:30 on sprint days", "Distraction spikes correlate with meeting-heavy afternoons", "Weekend activity remains at zero as configured"]'::jsonb,
    '["Consolidate stand-ups to 09:00 to protect mid-morning focus windows", "Review Marketing tool stack for workflow friction", "Investigate WS-9001 connectivity before next shift"]'::jsonb,
    0.92, 'google/gemini-2.5-flash'
  );

  -- Goals
  INSERT INTO public.goals (org_id, metric, target_value, period) VALUES
    (NEW.id, 'productivity_score', 75, 'weekly'),
    (NEW.id, 'focus_score', 70, 'weekly'),
    (NEW.id, 'distracted_ratio', 10, 'monthly');

  -- Audit trail
  INSERT INTO public.audit_logs (org_id, actor_email, action, entity_type, entity_id, metadata, created_at) VALUES
    (NEW.id, COALESCE(_email, 'system'), 'schedule.default_created', 'monitoring_schedule', NULL, '{"days":"Mon-Fri","window":"09:00-18:00"}'::jsonb, now() - interval '21 days'),
    (NEW.id, COALESCE(_email, 'system'), 'user.invited', 'profile', NULL, '{"count":7}'::jsonb, now() - interval '21 days'),
    (NEW.id, COALESCE(_email, 'system'), 'device.registered', 'device', NULL, '{"count":5}'::jsonb, now() - interval '20 days');

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID, UUID) TO authenticated;