begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@test');
update public.profiles set role = 'owner', active = true where id = '00000000-0000-0000-0000-000000000001';
insert into public.workers (id, name, hire_date) values ('10000000-0000-0000-0000-000000000001', 'Ana', current_date - 200);
insert into public.sick_ledger (worker_id, kind, hours, effective_on) values ('10000000-0000-0000-0000-000000000001', 'adjust', 8, current_date - 10);
insert into public.sick_requests (id, worker_id, kind, on_date, hours, reason, status, shift_start, submitted_at, late)
  values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'unplanned', current_date - 1, 4, 'flu', 'approved', now() - interval '1 day', now() - interval '26 hours', false);
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  begin perform public.add_attendance_event('10000000-0000-0000-0000-000000000001', 'unexcused', current_date - 1, 'x'); raise exception 'should refuse';
  exception when others then assert sqlerrm like '%approved sick time%', sqlerrm; end;
  begin perform public.add_attendance_event('10000000-0000-0000-0000-000000000001', 'late_notice', current_date - 1, 'x'); raise exception 'should refuse';
  exception when others then assert sqlerrm like '%approved sick time%', sqlerrm; end;
end $$;
select public.add_attendance_event('10000000-0000-0000-0000-000000000001', 'no_call_no_show', current_date - 3, 'did not show');
select public.add_attendance_event('10000000-0000-0000-0000-000000000001', 'tardy', current_date - 2, '20 min');
do $$ begin
  assert public.attendance_points('10000000-0000-0000-0000-000000000001', current_date) = 3.5, 'points 3 + 0.5';
  assert public.attendance_points('10000000-0000-0000-0000-000000000001', current_date + 400) = 0, 'points expire';
end $$;
select public.issue_discipline('10000000-0000-0000-0000-000000000001', 'Verbal warning', 'attendance');
do $$ begin assert (select points_at_time from public.discipline_actions limit 1) = 3.5, 'points recorded'; end $$;
select public.terminate_worker('10000000-0000-0000-0000-000000000001', current_date, 'quit');
do $$ begin
  assert (select terminated_on from public.workers where id = '10000000-0000-0000-0000-000000000001') = current_date, 'terminated';
  assert (select archived from public.workers where id = '10000000-0000-0000-0000-000000000001'), 'archived';
end $$;
select 'attendance.sql passed' as result;
rollback;
