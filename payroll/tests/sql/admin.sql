begin;
-- a plain owner cannot touch the administrator; the administrator can hand out ownership
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@test');
update public.profiles set role = 'owner', active = true where id = '00000000-0000-0000-0000-000000000001';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000002', 'staff@test');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ declare v_admin uuid := (select id from public.profiles where is_admin limit 1); begin
  begin perform public.set_profile(v_admin, 'employee', false, null); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'Only an administrator%', sqlerrm; end;
  begin perform public.set_admin('00000000-0000-0000-0000-000000000002', true); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'Only an administrator%', sqlerrm; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where is_admin limit 1), 'role', 'authenticated')::text, true);
do $$ begin
  assert public.app_role() = 'owner', 'admin acts as owner';
  perform public.set_profile('00000000-0000-0000-0000-000000000002', 'owner', true, null);
  assert (select role from public.profiles where id = '00000000-0000-0000-0000-000000000002') = 'owner', 'admin made an owner';
end $$;
select 'admin.sql passed' as result;
rollback;
