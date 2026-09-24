begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@test');
update public.profiles set role = 'owner', active = true where id = '00000000-0000-0000-0000-000000000001';
insert into public.workers (id, name, hire_date, rate, type) values ('10000000-0000-0000-0000-000000000009', 'Con', current_date - 100, 30, '1099');
insert into public.sites (id, name) values ('20000000-0000-0000-0000-000000000009', 'JobSite');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$ begin
  begin perform public.schedule_shift('10000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', current_date + 1, 'fixed', time '09:00', null, null, 2, true, false, 1, ''); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'Contractors are not scheduled%', sqlerrm; end;
  begin perform public.add_punch('10000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', now() - interval '3 hours', now() - interval '1 hour', 0, 'test'); raise exception 'should refuse';
  exception when others then assert sqlerrm like 'Contractors do not clock in%', sqlerrm; end;
end $$;
select 'contractors.sql passed' as result;
rollback;
