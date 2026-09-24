begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@test');
update public.profiles set role = 'owner', active = true where id = '00000000-0000-0000-0000-000000000001';
insert into public.workers (id, name, hire_date, rate) values ('10000000-0000-0000-0000-000000000001', 'Ana', current_date - 200, 20);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000002', 'ana@test');
update public.profiles set active = true, worker_id = '10000000-0000-0000-0000-000000000001' where id = '00000000-0000-0000-0000-000000000002';
insert into public.sites (id, name) values ('20000000-0000-0000-0000-000000000001', 'Office');
insert into public.site_tasks (id, site_id, title, proof, proof_required) values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Mop', 'photo', true);
-- schedule as owner: a window shift tonight (opened an hour ago, due in 3 h), planned 4 h, requires tasks
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.schedule_shift('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', ((now() - interval '1 hour') at time zone 'America/Detroit')::date, 'window',
  null, ((now() - interval '1 hour') at time zone 'America/Detroit')::time, ((now() + interval '3 hours') at time zone 'America/Detroit')::time, 4, true, true, 1, '');
-- and a fixed shift next week repeating 3 weeks
select count(*) as made from public.schedule_shift('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', current_date + 7, 'fixed', time '09:00', null, null, 3, true, false, 3, '');
do $$ begin
  assert (select count(*) from public.shifts where kind = 'fixed') = 3, 'three weekly shifts';
  assert (select count(distinct series_id) from public.shifts where kind = 'fixed') = 1, 'one series';
  assert (select window_due > window_open from public.shifts where kind = 'window'), 'window due after open';
end $$;
-- Ana clocks in: links to the window shift, started_late because only 3 h remain for a 4 h job
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.clock_in('20000000-0000-0000-0000-000000000001', null, null, null);
do $$ declare p public.punches; begin
  select * into p from public.punches where status = 'open' and worker_id = '10000000-0000-0000-0000-000000000001';
  assert p.shift_id is not null, 'linked to shift';
  assert p.planned_hours = 4, 'planned copied';
  assert p.started_late, 'started late flag';
end $$;
-- finish after 30 minutes without the required task: paid = worked
reset role;
update public.punches set clock_in = now() - interval '30 minutes' where status = 'open' and worker_id = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.clock_out(null, null, null);
do $$ declare p public.punches; begin
  select * into p from public.punches where worker_id = '10000000-0000-0000-0000-000000000001' limit 1;
  assert p.paid_hours = 0.5, 'no guarantee without required task, got ' || p.paid_hours;
  assert (select status from public.shifts where kind = 'window') = 'done', 'shift done';
end $$;
-- now tick the required task (as if done during the shift) and re-derive: paid = planned 4
reset role;
insert into public.task_checks (punch_id, task_id, proof_path, proof_type) select id, '50000000-0000-0000-0000-000000000001', 'x/y.jpg', 'photo' from public.punches where worker_id = '10000000-0000-0000-0000-000000000001';
update public.punches set break_minutes = 0 where worker_id = '10000000-0000-0000-0000-000000000001';   -- fires the derive trigger
do $$ declare p public.punches; begin
  select * into p from public.punches where worker_id = '10000000-0000-0000-0000-000000000001' limit 1;
  assert p.paid_hours = 4, 'guarantee applies once tasks done, got ' || p.paid_hours;
  assert public.app_worked_hours(p) = 0.5, 'worked stays 0.5';
end $$;
-- a window shift not yet open blocks clock-in
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.schedule_shift('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', ((now() + interval '2 hours') at time zone 'America/Detroit')::date, 'window',
  null, ((now() + interval '2 hours') at time zone 'America/Detroit')::time, ((now() + interval '8 hours') at time zone 'America/Detroit')::time, 2, true, false, 1, '');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
do $$ begin
  begin perform public.clock_in('20000000-0000-0000-0000-000000000001', null, null, null); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'This site opens at%', sqlerrm; end;
end $$;
-- sweep: a fixed shift 6 hours ago with no punch becomes missed; a sick day becomes sick
reset role;
insert into public.shifts (worker_id, site_id, on_date, kind, start_at, planned_hours) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', current_date, 'fixed', now() - interval '6 hours', 2);
insert into public.shifts (worker_id, site_id, on_date, kind, start_at, planned_hours) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', current_date + 30, 'fixed', now() + interval '30 days', 2);
insert into public.sick_requests (worker_id, kind, on_date, hours, reason, status) values ('10000000-0000-0000-0000-000000000001', 'planned', current_date + 30, 2, 'dr', 'approved');
select public.sweep_shifts();
do $$ begin
  assert (select count(*) from public.shifts where status = 'missed' and worker_id = '10000000-0000-0000-0000-000000000001') = 1, 'one missed';
  assert (select count(*) from public.shifts where status = 'sick' and worker_id = '10000000-0000-0000-0000-000000000001') = 1, 'one sick';
end $$;
select 'schedule.sql passed' as result;
rollback;
