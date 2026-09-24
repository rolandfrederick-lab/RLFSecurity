begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@test');
update public.profiles set role = 'owner', active = true where id = '00000000-0000-0000-0000-000000000001';
insert into public.workers (id, name, hire_date, rate) values ('10000000-0000-0000-0000-000000000001', 'Ana', current_date - 200, 20);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000002', 'ana@test');
update public.profiles set active = true, worker_id = '10000000-0000-0000-0000-000000000001' where id = '00000000-0000-0000-0000-000000000002';
insert into public.sites (id, name) values ('20000000-0000-0000-0000-000000000001', 'Office');
insert into public.site_assignments values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
-- 30 approved hours -> 1.0 h accrued via trigger, idempotent
insert into public.punches (id, worker_id, site_id, clock_in, clock_out, status) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', now() - interval '40 hours', now() - interval '10 hours', 'approved');
select public.accrue_sick_for_punch('30000000-0000-0000-0000-000000000001');
do $$ begin
  assert (select sum(hours) from public.sick_ledger where kind = 'accrual') = 1.0, 'accrued 1.0';
  assert (select count(*) from public.sick_ledger) = 1, 'one accrual row per punch';
end $$;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
do $$ begin
  assert (public.sick_balance('10000000-0000-0000-0000-000000000001', current_date)->>'available')::numeric = 1.0, 'available 1.0';
  begin perform public.submit_sick_request('planned', current_date + 3, 1, 'dentist', null); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'Planned sick time needs%', sqlerrm; end;
  begin perform public.submit_sick_request('unplanned', current_date, 1, '', null); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'Tell us briefly%', sqlerrm; end;
  begin perform public.submit_sick_request('unplanned', current_date, 2, 'flu', null); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'You have 1.00 hours%', sqlerrm; end;
end $$;
select public.submit_sick_request('planned', current_date + 7, 1, 'dentist', null);
do $$ begin
  assert (select count(*) from public.sick_requests where status = 'pending') = 1, 'planned 7 days ahead accepted';
  assert (select late from public.sick_requests limit 1) = false, 'not late';
end $$;
select public.submit_sick_request('unplanned', current_date, 0.5, 'sick', now() - interval '1 hour');
do $$ begin assert (select late from public.sick_requests where kind = 'unplanned') = true, 'late flag'; end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.decide_sick_request((select id from public.sick_requests where kind = 'planned'), 'approved', '');
do $$ begin
  assert (select sum(hours) from public.sick_ledger where kind = 'use') = -1.0, 'use row written';
  assert (public.sick_balance('10000000-0000-0000-0000-000000000001', current_date + 7)->>'available')::numeric = 0, 'balance down to 0';
  begin perform public.decide_sick_request((select id from public.sick_requests where kind = 'planned'), 'denied', ''); raise exception 'should refuse';
  exception when others then assert sqlerrm like '%already decided%', sqlerrm; end;
  begin perform public.request_documentation((select id from public.sick_requests where kind = 'planned')); raise exception 'should refuse';
  exception when others then assert sqlerrm like '%3 or more%', sqlerrm; end;
end $$;
reset role;
insert into public.workers (id, name, hire_date) values ('10000000-0000-0000-0000-000000000002', 'Ben', current_date - 100);
insert into public.sick_ledger (worker_id, kind, hours, effective_on) values ('10000000-0000-0000-0000-000000000002', 'adjust', 5, current_date);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000003', 'ben@test');
update public.profiles set active = true, worker_id = '10000000-0000-0000-0000-000000000002' where id = '00000000-0000-0000-0000-000000000003';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
do $$ begin
  begin perform public.submit_sick_request('unplanned', current_date, 1, 'sick', null); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'You can start using sick time on%', sqlerrm; end;
end $$;
select 'sick.sql passed' as result;
rollback;
