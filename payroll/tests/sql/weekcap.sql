begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@test');
update public.profiles set role = 'owner', active = true where id = '00000000-0000-0000-0000-000000000001';
insert into public.workers (id, name, hire_date) values ('10000000-0000-0000-0000-000000000001', 'Ana', current_date - 200);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000002', 'ana@test');
update public.profiles set active = true, worker_id = '10000000-0000-0000-0000-000000000001' where id = '00000000-0000-0000-0000-000000000002';
insert into public.sites (id, name) values ('20000000-0000-0000-0000-000000000001', 'Office');
insert into public.site_assignments values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
update public.settings set data = data || '{"weekStart":1,"hours":{"weeklyCap":40,"capMode":"warn"}}'::jsonb;
-- 40 hours this payroll week: three 13h20m shifts starting Monday 6am Detroit time
insert into public.punches (worker_id, site_id, clock_in, clock_out, status)
  select '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', d, d + interval '13 hours 20 minutes', 'approved'
  from generate_series((public.app_week_start(current_date) + time '06:00') at time zone 'America/Detroit',
                       (public.app_week_start(current_date) + time '06:00') at time zone 'America/Detroit' + interval '2 days', interval '1 day') d;
do $$ begin assert round(public.week_hours('10000000-0000-0000-0000-000000000001', public.app_week_start(current_date) + interval '3 days'), 1) = 40.0,
  'week hours 40, got ' || public.week_hours('10000000-0000-0000-0000-000000000001', public.app_week_start(current_date) + interval '3 days'); end $$;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.clock_in('20000000-0000-0000-0000-000000000001', null, null, null);
select public.clock_out(null, null, null);
reset role;
update public.workers set cap_mode = 'block' where id = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
do $$ begin
  begin perform public.clock_in('20000000-0000-0000-0000-000000000001', null, null, null); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'You have reached your weekly hours cap%', sqlerrm; end;
end $$;
select 'weekcap.sql passed' as result;
rollback;
