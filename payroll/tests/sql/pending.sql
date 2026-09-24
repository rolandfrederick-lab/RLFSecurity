begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@test');
update public.profiles set role = 'owner', active = true where id = '00000000-0000-0000-0000-000000000001';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000002', 'new@test');
-- the new, unapproved login fills paperwork
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.submit_pending_paperwork('Rosa','','Diaz','9 Elm','','Detroit','MI','48201','412-11-2233','detroit','HOH',false,0,0,0,0,2,'Rosa Diaz');
do $$ begin assert (public.my_pending_paperwork()->>'ssn_last4') = '2233', 'pending stored'; end $$;
-- owner creates the worker and links it
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin assert (select count(*) from public.pending_paperwork_names()) >= 1, 'owner sees pending'; end $$;
reset role;
insert into public.workers (id, name, hire_date, rate) values ('10000000-0000-0000-0000-000000000001', 'Rosa Diaz', current_date, 18);
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.set_profile('00000000-0000-0000-0000-000000000002', 'employee', true, '10000000-0000-0000-0000-000000000001');
do $$ begin
  assert (public.worker_details('10000000-0000-0000-0000-000000000001')->>'ssn_last4') = '2233', 'moved to worker';
  assert (select filing || '/' || mi_exemptions || '/' || home_city from public.workers where id = '10000000-0000-0000-0000-000000000001') = 'HOH/2/detroit', 'w4 applied';
  assert public.get_worker_ssn('10000000-0000-0000-0000-000000000001', 'test') = '412112233', 'ssn decrypts after move';
end $$;
reset role;
do $$ begin assert (select count(*) from public.pending_paperwork where profile_id = '00000000-0000-0000-0000-000000000002') = 0, 'pending cleared'; end $$;
select 'pending.sql passed' as result;
rollback;
