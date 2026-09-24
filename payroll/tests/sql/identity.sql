begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@test');
update public.profiles set role = 'owner', active = true where id = '00000000-0000-0000-0000-000000000001';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000009', 'mgr@test');
update public.profiles set role = 'manager', active = true where id = '00000000-0000-0000-0000-000000000009';
insert into public.workers (id, name, hire_date, rate) values ('10000000-0000-0000-0000-000000000001', 'Ana', current_date - 200, 20);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000002', 'ana@test');
update public.profiles set active = true, worker_id = '10000000-0000-0000-0000-000000000001' where id = '00000000-0000-0000-0000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
do $$ begin
  begin perform public.submit_paperwork('Ana','','Lopez','1 Main St','','Detroit','MI','48201','000-12-3456','detroit','Single',false,0,0,0,0,1,'Ana Lopez'); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'That does not look like a valid%', sqlerrm; end;
end $$;
select public.submit_paperwork('Ana','','Lopez','1 Main St','','Detroit','MI','48201','412-34-5678','detroit','MFJ',false,2000,10,0,0,2,'Ana Lopez');
do $$ declare d jsonb := public.worker_details('10000000-0000-0000-0000-000000000001'); begin
  assert d->>'ssn_last4' = '5678', 'last4';
  assert (d->>'has_ssn')::boolean, 'has ssn';
  assert (select filing from public.workers where id = '10000000-0000-0000-0000-000000000001') = 'MFJ', 'w4 saved';
  begin perform public.get_worker_ssn('10000000-0000-0000-0000-000000000001', 'test'); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'Only an owner%', sqlerrm; end;
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000009","role":"authenticated"}';
do $$ begin
  assert (public.worker_details('10000000-0000-0000-0000-000000000001')->>'ssn_last4') = '5678', 'manager sees last4';
  begin perform public.get_worker_ssn('10000000-0000-0000-0000-000000000001', 'test'); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'Only an owner%', sqlerrm; end;
  begin perform public.set_worker_private('10000000-0000-0000-0000-000000000001','Ana','','Lopez','1 Main','','Detroit','MI','48201','412-34-5678','detroit'); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'Only an owner or administrator can enter%', sqlerrm; end;
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  assert public.get_worker_ssn('10000000-0000-0000-0000-000000000001', 'W-2 test') = '412345678', 'owner decrypts';
  assert (select count(*) from public.pii_access_log where worker_id = '10000000-0000-0000-0000-000000000001') = 1, 'reveal logged';
  assert (select ssn from public.get_all_ssns('year end') where worker_id = '10000000-0000-0000-0000-000000000001') = '412345678', 'bulk decrypt';
end $$;
select 'identity.sql passed' as result;
rollback;
