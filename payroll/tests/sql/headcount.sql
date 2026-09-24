begin;
insert into public.workers (name, hire_date) select 'W' || g, date '2026-01-05' from generate_series(1, 9) g;
select public.rebuild_headcount();
do $$ begin
  assert (public.employer_status(date '2026-06-01')->>'small_business')::boolean, '9 workers should be small';
  assert (public.employer_status(date '2026-06-01')->>'sick_use_cap')::numeric = 40, 'cap 40 while small';
end $$;
insert into public.workers (name, hire_date) values ('W10', date '2026-01-05');
select public.rebuild_headcount();
do $$ begin
  assert (public.employer_status(date '2026-05-10')->>'small_business')::boolean, 'week 19 still small';
  assert not (public.employer_status(date '2026-05-25')->>'small_business')::boolean, 'week 20 flips';
  assert (public.employer_status(date '2026-05-25')->>'sick_use_cap')::numeric = 72, 'cap 72 once large';
  assert not (public.employer_status(date '2027-06-01')->>'small_business')::boolean, 'stays large the following year';
  assert (select count(*) from public.status_changes where kind = 'small_business_lost') = 1, 'one status change row';
end $$;
update public.settings set data = data || '{"sick":{"extraUseCap":50}}'::jsonb;
do $$ begin
  assert (public.employer_status(date '2026-05-25')->>'sick_use_cap')::numeric = 72, 'extra 50 ignored when floor is 72';
  assert (public.employer_status(date '2026-03-01')->>'sick_use_cap')::numeric = 50, 'extra 50 applies while small';
end $$;
select 'headcount.sql passed' as result;
rollback;
