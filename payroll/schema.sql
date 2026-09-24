-- =====================================================================
-- R L Frederick Private Security payroll + time clock  |  Supabase database setup
-- Run this whole file ONCE in the Supabase SQL Editor (new project).
-- The FIRST person to create an account in the app becomes the owner.
-- =====================================================================

-- ---------- Tables ----------
create table public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'W-2' check (type in ('W-2','1099')),
  rate numeric not null default 0,
  filing text not null default 'Single' check (filing in ('Single','MFJ','HOH')),
  step2 boolean not null default false,
  dependents_credit numeric not null default 0,
  extra_withholding numeric not null default 0,
  other_income numeric not null default 0,
  deductions numeric not null default 0,
  mi_exemptions numeric not null default 0,
  city_rate numeric not null default 0,
  notes text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role text not null default 'employee' check (role in ('owner','manager','supervisor','employee')),
  active boolean not null default false,
  worker_id uuid unique references public.workers(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);
insert into public.settings (id, data) values (1, '{}'::jsonb);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  lat double precision,
  lng double precision,
  radius_m int not null default 150 check (radius_m between 25 and 5000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.site_assignments (
  site_id uuid not null references public.sites(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  primary key (site_id, worker_id)
);

create table public.paychecks (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  worker_name text not null,
  type text not null,
  pay_date date not null,
  year int not null,
  period_start date,
  period_end date,
  reg_hours numeric not null default 0,
  ot_hours numeric not null default 0,
  other_pay numeric not null default 0,
  rate numeric not null default 0,
  gross numeric not null, fed numeric not null default 0, ss numeric not null default 0, med numeric not null default 0,
  state numeric not null default 0, city numeric not null default 0, other_ded numeric not null default 0, net numeric not null,
  er_ss numeric not null default 0, er_med numeric not null default 0, futa numeric not null default 0, suta numeric not null default 0,
  employer_cost numeric not null default 0, fed941 numeric not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index paychecks_year_idx on public.paychecks (year, pay_date);

create table public.punches (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  site_id uuid references public.sites(id) on delete set null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  break_minutes int not null default 0 check (break_minutes >= 0),
  status text not null default 'open' check (status in ('open','submitted','approved','rejected')),
  in_lat double precision, in_lng double precision, in_accuracy_m double precision, in_distance_m double precision,
  out_lat double precision, out_lng double precision, out_accuracy_m double precision, out_distance_m double precision,
  in_flagged boolean not null default false,
  out_flagged boolean not null default false,
  manual boolean not null default false,
  paycheck_id uuid references public.paychecks(id) on delete set null,
  created_at timestamptz not null default now()
);
create index punches_worker_idx on public.punches (worker_id, clock_in);
create unique index punches_one_open on public.punches (worker_id) where status = 'open';

create table public.punch_edits (
  id uuid primary key default gen_random_uuid(),
  punch_id uuid not null references public.punches(id) on delete cascade,
  edited_by uuid not null,
  edited_by_name text not null default '',
  edited_at timestamptz not null default now(),
  reason text not null default '',
  before jsonb,
  after jsonb
);

create table public.deposits (
  year int not null,
  key text not null,
  paid_on date not null default current_date,
  primary key (year, key)
);

-- ---------- Helper functions ----------
create function public.app_role() returns text
  language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() and active $$;

create function public.app_worker_id() returns uuid
  language sql stable security definer set search_path = public as
$$ select worker_id from public.profiles where id = auth.uid() and active $$;

create function public.app_my_sites() returns setof uuid
  language sql stable security definer set search_path = public as
$$ select site_id from public.site_assignments where worker_id = public.app_worker_id() $$;

create function public.app_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
  returns double precision language sql immutable as
$$ select 2 * 6371000 * asin(least(1, sqrt(
     power(sin(radians(lat2 - lat1) / 2), 2) +
     cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))) $$;

-- New accounts: the first one becomes the owner, everyone after waits for approval.
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare v_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_first;
  insert into public.profiles (id, email, full_name, role, active)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''),
          case when v_first then 'owner' else 'employee' end, v_first);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row level security ----------
alter table public.workers enable row level security;
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.sites enable row level security;
alter table public.site_assignments enable row level security;
alter table public.paychecks enable row level security;
alter table public.punches enable row level security;
alter table public.punch_edits enable row level security;
alter table public.deposits enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.app_role() in ('owner','manager'));
-- profiles are changed only through set_profile()

create policy workers_read on public.workers for select to authenticated
  using (public.app_role() in ('owner','manager') or id = public.app_worker_id());
create policy workers_write on public.workers for all to authenticated
  using (public.app_role() in ('owner','manager')) with check (public.app_role() in ('owner','manager'));

create policy settings_read on public.settings for select to authenticated using (public.app_role() is not null);
create policy settings_write on public.settings for update to authenticated
  using (public.app_role() = 'owner') with check (public.app_role() = 'owner');

create policy sites_read on public.sites for select to authenticated using (public.app_role() is not null);
create policy sites_write on public.sites for all to authenticated
  using (public.app_role() in ('owner','manager')) with check (public.app_role() in ('owner','manager'));

create policy assign_read on public.site_assignments for select to authenticated
  using (public.app_role() in ('owner','manager') or worker_id = public.app_worker_id()
         or (public.app_role() = 'supervisor' and site_id in (select public.app_my_sites())));
create policy assign_write on public.site_assignments for all to authenticated
  using (public.app_role() in ('owner','manager')) with check (public.app_role() in ('owner','manager'));

create policy paychecks_read on public.paychecks for select to authenticated
  using (public.app_role() in ('owner','manager') or worker_id = public.app_worker_id());
create policy paychecks_insert on public.paychecks for insert to authenticated
  with check (public.app_role() in ('owner','manager'));
create policy paychecks_delete on public.paychecks for delete to authenticated
  using (public.app_role() in ('owner','manager'));

create policy punches_read on public.punches for select to authenticated
  using (public.app_role() in ('owner','manager') or worker_id = public.app_worker_id()
         or (public.app_role() = 'supervisor' and site_id in (select public.app_my_sites())));
-- punches are written only through the functions below

create policy edits_read on public.punch_edits for select to authenticated
  using (public.app_role() in ('owner','manager','supervisor')
         and exists (select 1 from public.punches p where p.id = punch_id));

create policy deposits_all on public.deposits for all to authenticated
  using (public.app_role() in ('owner','manager')) with check (public.app_role() in ('owner','manager'));

-- Names only, so supervisors can read a timesheet without seeing pay rates or W-4 answers.
create view public.worker_directory as
  select w.id, w.name, w.archived from public.workers w
  where public.app_role() in ('owner','manager','supervisor');

-- ---------- Time clock functions ----------
create function public.clock_in(p_site uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
  returns public.punches language plpgsql security definer set search_path = public as
$$
declare v_worker uuid := public.app_worker_id(); v_site public.sites; v_dist double precision; v_flag boolean := false;
        v_policy text; v_row public.punches;
begin
  if v_worker is null then raise exception 'Your login is not linked to a worker yet. Ask a manager to finish your setup.'; end if;
  select * into v_site from public.sites where id = p_site and active;
  if not found then raise exception 'That site is not available.'; end if;
  if not exists (select 1 from public.site_assignments where site_id = p_site and worker_id = v_worker) then
    raise exception 'You are not assigned to %.', v_site.name; end if;
  if exists (select 1 from public.punches where worker_id = v_worker and status = 'open') then
    raise exception 'You are already clocked in.'; end if;
  select coalesce(data->>'outsidePolicy', 'block') into v_policy from public.settings where id = 1;
  if v_site.lat is not null and v_site.lng is not null then
    if p_lat is null or p_lng is null then
      v_flag := true;
      if v_policy = 'block' then raise exception 'Location is needed to clock in. Allow location for this app and try again.'; end if;
    else
      v_dist := public.app_distance_m(p_lat, p_lng, v_site.lat, v_site.lng);
      v_flag := v_dist > v_site.radius_m;
      if v_flag and v_policy = 'block' then
        raise exception 'You are about % meters from %. Clock in when you are on site.', round(v_dist), v_site.name; end if;
    end if;
  end if;
  insert into public.punches (worker_id, site_id, clock_in, status, in_lat, in_lng, in_accuracy_m, in_distance_m, in_flagged)
  values (v_worker, p_site, now(), 'open', p_lat, p_lng, p_accuracy, v_dist, v_flag) returning * into v_row;
  return v_row;
end $$;

-- Clocking out is never blocked. Leaving from off site is flagged for review instead.
create function public.clock_out(p_lat double precision, p_lng double precision, p_accuracy double precision)
  returns public.punches language plpgsql security definer set search_path = public as
$$
declare v_worker uuid := public.app_worker_id(); v_p public.punches; v_site public.sites; v_dist double precision; v_flag boolean := false;
        v_auto boolean; v_row public.punches;
begin
  select * into v_p from public.punches where worker_id = v_worker and status = 'open';
  if not found then raise exception 'You are not clocked in.'; end if;
  select * into v_site from public.sites where id = v_p.site_id;
  if v_site.lat is not null and v_site.lng is not null then
    if p_lat is null or p_lng is null then v_flag := true;
    else v_dist := public.app_distance_m(p_lat, p_lng, v_site.lat, v_site.lng); v_flag := v_dist > v_site.radius_m; end if;
  end if;
  select coalesce((data->>'autoApprove')::boolean, false) into v_auto from public.settings where id = 1;
  update public.punches set clock_out = now(), out_lat = p_lat, out_lng = p_lng, out_accuracy_m = p_accuracy,
         out_distance_m = v_dist, out_flagged = v_flag,
         status = case when v_auto and not v_flag and not in_flagged then 'approved' else 'submitted' end
   where id = v_p.id returning * into v_row;
  return v_row;
end $$;

create function public.app_can_manage_punch(p_worker uuid, p_site uuid) returns boolean
  language plpgsql stable security definer set search_path = public as
$$
declare v_role text := public.app_role();
begin
  if v_role in ('owner','manager') then return true; end if;
  if v_role = 'supervisor' then
    if p_worker = public.app_worker_id() then raise exception 'Supervisors cannot change their own hours. Ask a manager.'; end if;
    return p_site in (select public.app_my_sites());
  end if;
  return false;
end $$;

create function public.edit_punch(p_id uuid, p_in timestamptz, p_out timestamptz, p_break int, p_status text, p_reason text)
  returns public.punches language plpgsql security definer set search_path = public as
$$
declare v_p public.punches; v_row public.punches; v_changed boolean; v_name text;
begin
  select * into v_p from public.punches where id = p_id;
  if not found then raise exception 'Shift not found.'; end if;
  if not public.app_can_manage_punch(v_p.worker_id, v_p.site_id) then raise exception 'You do not have access to this shift.'; end if;
  if v_p.paycheck_id is not null then raise exception 'This shift is already on a paycheck. Delete that paycheck first.'; end if;
  if p_status not in ('submitted','approved','rejected') then raise exception 'Unknown status.'; end if;
  if p_out is null then raise exception 'Enter a clock-out time.'; end if;
  if p_out <= p_in then raise exception 'Clock-out must be after clock-in.'; end if;
  if p_out - p_in > interval '24 hours' then raise exception 'A shift cannot be longer than 24 hours.'; end if;
  v_changed := p_in is distinct from v_p.clock_in or p_out is distinct from v_p.clock_out or coalesce(p_break, 0) <> v_p.break_minutes;
  if (v_changed or p_status = 'rejected') and coalesce(trim(p_reason), '') = '' then
    raise exception 'Enter a reason for this change.'; end if;
  update public.punches set clock_in = p_in, clock_out = p_out, break_minutes = coalesce(p_break, 0), status = p_status
   where id = p_id returning * into v_row;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.punch_edits (punch_id, edited_by, edited_by_name, reason, before, after)
  values (p_id, auth.uid(), coalesce(v_name, ''), coalesce(p_reason, ''),
    jsonb_build_object('clock_in', v_p.clock_in, 'clock_out', v_p.clock_out, 'break_minutes', v_p.break_minutes, 'status', v_p.status),
    jsonb_build_object('clock_in', v_row.clock_in, 'clock_out', v_row.clock_out, 'break_minutes', v_row.break_minutes, 'status', v_row.status));
  return v_row;
end $$;

create function public.add_punch(p_worker uuid, p_site uuid, p_in timestamptz, p_out timestamptz, p_break int, p_reason text)
  returns public.punches language plpgsql security definer set search_path = public as
$$
declare v_row public.punches; v_name text;
begin
  if not public.app_can_manage_punch(p_worker, p_site) then raise exception 'You do not have access to add hours here.'; end if;
  if p_out is null or p_out <= p_in then raise exception 'Clock-out must be after clock-in.'; end if;
  if p_out - p_in > interval '24 hours' then raise exception 'A shift cannot be longer than 24 hours.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Enter a reason for adding these hours.'; end if;
  insert into public.punches (worker_id, site_id, clock_in, clock_out, break_minutes, status, manual)
  values (p_worker, p_site, p_in, p_out, coalesce(p_break, 0), 'approved', true) returning * into v_row;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.punch_edits (punch_id, edited_by, edited_by_name, reason, before, after)
  values (v_row.id, auth.uid(), coalesce(v_name, ''), p_reason, null,
    jsonb_build_object('clock_in', v_row.clock_in, 'clock_out', v_row.clock_out, 'break_minutes', v_row.break_minutes, 'status', v_row.status));
  return v_row;
end $$;

create function public.attach_punches(p_paycheck uuid, p_ids uuid[]) returns int
  language plpgsql security definer set search_path = public as
$$
declare v_n int;
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can run payroll.'; end if;
  update public.punches p set paycheck_id = p_paycheck
   where p.id = any(p_ids) and p.status = 'approved' and p.paycheck_id is null
     and p.worker_id = (select worker_id from public.paychecks where id = p_paycheck);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Roles, approval and linking a login to a worker record.
create function public.set_profile(p_id uuid, p_role text, p_active boolean, p_worker uuid)
  returns public.profiles language plpgsql security definer set search_path = public as
$$
declare v_me text := public.app_role(); v_t public.profiles; v_row public.profiles;
begin
  if v_me is null or v_me not in ('owner','manager') then raise exception 'Only an owner or manager can manage people.'; end if;
  if p_role not in ('owner','manager','supervisor','employee') then raise exception 'Unknown role.'; end if;
  select * into v_t from public.profiles where id = p_id;
  if not found then raise exception 'Person not found.'; end if;
  if v_me = 'manager' and (v_t.role in ('owner','manager') or p_role in ('owner','manager')) then
    raise exception 'Only an owner can change owners and managers.'; end if;
  if v_t.role = 'owner' and v_t.active and (p_role <> 'owner' or not p_active)
     and (select count(*) from public.profiles where role = 'owner' and active) <= 1 then
    raise exception 'There must be at least one active owner.'; end if;
  if p_worker is not null and exists (select 1 from public.profiles where worker_id = p_worker and id <> p_id) then
    raise exception 'That worker is already linked to another login.'; end if;
  update public.profiles set role = p_role, active = p_active, worker_id = p_worker where id = p_id returning * into v_row;
  return v_row;
end $$;

-- ---------- Permissions ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.workers, public.sites, public.site_assignments, public.deposits to authenticated;
grant select, insert, delete on public.paychecks to authenticated;
grant select, update on public.settings to authenticated;
grant select on public.profiles, public.punches, public.punch_edits, public.worker_directory to authenticated;

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
grant execute on function public.app_role(), public.app_worker_id(), public.app_my_sites(),
  public.app_distance_m(double precision, double precision, double precision, double precision),
  public.app_can_manage_punch(uuid, uuid),
  public.clock_in(uuid, double precision, double precision, double precision),
  public.clock_out(double precision, double precision, double precision),
  public.edit_punch(uuid, timestamptz, timestamptz, int, text, text),
  public.add_punch(uuid, uuid, timestamptz, timestamptz, int, text),
  public.attach_punches(uuid, uuid[]),
  public.set_profile(uuid, text, boolean, uuid)
to authenticated;

-- Sign-ups are created by Supabase's auth service, so it must be able to run the new-account trigger.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end $$;

-- =====================================================================
-- Piece 1 (2026-09-19): weekly hours guard, earned sick time, attendance,
-- discipline, headcount engine. Identical to supabase/migrations/20260919_piece1.sql
-- so a fresh install still needs only this one file.
-- =====================================================================

-- ===== A. worker fields, headcount engine =====
alter table public.workers
  add column hire_date date,
  add column weekly_cap numeric check (weekly_cap is null or weekly_cap > 0),
  add column cap_mode text check (cap_mode is null or cap_mode in ('warn','block')),
  add column terminated_on date,
  add column termination_reason text not null default '';
update public.workers set hire_date = created_at::date where hire_date is null;

create table public.headcount_weeks (
  week_start date primary key,
  headcount int not null,
  fte numeric not null default 0,
  computed_at timestamptz not null default now()
);
create table public.status_changes (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  changed_on date not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  unique (kind, changed_on)
);
alter table public.headcount_weeks enable row level security;
alter table public.status_changes enable row level security;
create policy headcount_read on public.headcount_weeks for select to authenticated using (public.app_role() is not null);
create policy status_read on public.status_changes for select to authenticated using (public.app_role() is not null);
grant select on public.headcount_weeks, public.status_changes to authenticated;

-- Monday-based week start for headcount, independent of the payroll workweek setting.
create function public.app_week_start(d date) returns date language sql immutable as
$$ select (d - (extract(isodow from d)::int - 1))::date $$;

-- Small unless 10+ heads in 20+ weeks of this or the prior calendar year.
-- Once lost in year Y, stays lost through Y+1 (any week in Y+1 looks back at Y).
create function public.app_is_small_on(d date) returns boolean language sql stable security definer set search_path = public as
$$ select not exists (
     select 1 from (
       select extract(year from week_start)::int y, count(*) filter (where headcount >= 10) n
       from public.headcount_weeks
       where week_start <= d and extract(year from week_start) in (extract(year from d), extract(year from d) - 1)
       group by 1) t
     where t.n >= 20) $$;

-- Headcount per week from hire and termination dates; FTE per month from punches.
create function public.rebuild_headcount() returns void
  language plpgsql security definer set search_path = public as
$$
declare v_from date; v_to date; v_prev_small boolean; v_small boolean; v_wk date;
begin
  select least(min(coalesce(hire_date, created_at::date)), (date_trunc('year', current_date) - interval '1 year')::date) into v_from from public.workers;
  if v_from is null then return; end if;
  v_from := public.app_week_start(v_from);
  v_to := greatest(public.app_week_start(current_date), v_from);
  delete from public.headcount_weeks where true;
  insert into public.headcount_weeks (week_start, headcount, fte)
  select w::date,
         (select count(*) from public.workers k
           where coalesce(k.hire_date, k.created_at::date) <= w::date + 6
             and (k.terminated_on is null or k.terminated_on >= w::date)
             and not k.archived),
         (select coalesce(sum(least(h, 130)) / 120.0, 0) from (
            select sum(extract(epoch from (coalesce(p.clock_out, p.clock_in) - p.clock_in)) / 3600 - p.break_minutes / 60.0) h
            from public.punches p where p.status <> 'rejected'
              and p.clock_in >= date_trunc('month', w) and p.clock_in < date_trunc('month', w) + interval '1 month'
            group by p.worker_id) m)
  from generate_series(v_from::timestamp, v_to::timestamp, interval '7 days') w;
  v_prev_small := true;
  for v_wk in select week_start from public.headcount_weeks order by week_start loop
    v_small := public.app_is_small_on(v_wk);
    if v_prev_small and not v_small then
      insert into public.status_changes (kind, changed_on, detail)
      values ('small_business_lost', v_wk, 'Ten or more employees in 20 or more weeks. Sick time caps are now 72 hours.')
      on conflict do nothing;
    end if;
    v_prev_small := v_small;
  end loop;
end $$;

create function public.employer_status(p_on date default current_date) returns jsonb
  language plpgsql stable security definer set search_path = public as
$$
declare v_hc int; v_w10 int; v_small boolean; v_lost date; v_fte numeric; v_floor numeric; v_use numeric; v_carry numeric; v_cfg jsonb;
begin
  select headcount into v_hc from public.headcount_weeks where week_start = public.app_week_start(p_on);
  select count(*) into v_w10 from public.headcount_weeks where headcount >= 10 and extract(year from week_start) = extract(year from p_on) and week_start <= p_on;
  v_small := public.app_is_small_on(p_on);
  select min(changed_on) into v_lost from public.status_changes where kind = 'small_business_lost' and changed_on <= p_on;
  select coalesce(avg(fte), 0) into v_fte from (
    select distinct on (date_trunc('month', week_start)) fte from public.headcount_weeks
    where extract(year from week_start) = extract(year from p_on) - 1 order by date_trunc('month', week_start), week_start) m;
  v_floor := case when v_small then 40 else 72 end;
  select coalesce(data->'sick', '{}'::jsonb) into v_cfg from public.settings where id = 1;
  v_use := greatest(v_floor, coalesce((v_cfg->>'extraUseCap')::numeric, 0));
  v_carry := greatest(v_floor, coalesce((v_cfg->>'extraCarryCap')::numeric, 0));
  return jsonb_build_object('headcount', coalesce(v_hc, 0), 'weeks_at_10', v_w10, 'small_business', v_small,
    'small_lost_on', v_lost, 'fte_prior_year', round(v_fte, 1), 'ale', v_fte >= 50,
    'sick_use_cap', v_use, 'sick_carry_cap', v_carry);
end $$;

create function public.workers_changed() returns trigger language plpgsql security definer set search_path = public as
$$ begin perform public.rebuild_headcount(); return null; end $$;
create trigger workers_headcount after insert or update of hire_date, terminated_on, archived or delete on public.workers
  for each statement execute function public.workers_changed();
select public.rebuild_headcount();

grant execute on function public.app_week_start(date), public.app_is_small_on(date), public.employer_status(date), public.rebuild_headcount() to authenticated;
-- ===== B. sick time =====
create table public.sick_ledger (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  kind text not null check (kind in ('accrual','use','carryover','adjust','forfeit')),
  hours numeric not null,
  effective_on date not null default current_date,
  punch_id uuid references public.punches(id) on delete set null,
  request_id uuid,
  note text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index sick_ledger_one_per_punch on public.sick_ledger (punch_id) where punch_id is not null;
create index sick_ledger_worker_idx on public.sick_ledger (worker_id, effective_on);

create table public.sick_requests (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  kind text not null check (kind in ('planned','unplanned')),
  on_date date not null,
  hours numeric not null check (hours > 0 and hours <= 24),
  reason text not null default '',
  submitted_at timestamptz not null default now(),
  shift_start timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','denied','cancelled')),
  decided_by uuid, decided_at timestamptz, decision_note text not null default '',
  late boolean not null default false,
  consecutive_run int not null default 1,
  doc_requested_on date, doc_due_on date, doc_received_on date,
  site_id uuid references public.sites(id) on delete set null
);
create index sick_requests_worker_idx on public.sick_requests (worker_id, on_date);

create table public.policy_acknowledgements (
  worker_id uuid not null references public.workers(id) on delete cascade,
  policy_version int not null,
  acknowledged_at timestamptz not null default now(),
  acknowledged_name text not null default '',
  primary key (worker_id, policy_version)
);

alter table public.sick_ledger enable row level security;
alter table public.sick_requests enable row level security;
alter table public.policy_acknowledgements enable row level security;
create policy sick_ledger_read on public.sick_ledger for select to authenticated
  using (public.app_role() in ('owner','manager') or worker_id = public.app_worker_id());
create policy sick_requests_read on public.sick_requests for select to authenticated
  using (public.app_role() in ('owner','manager') or worker_id = public.app_worker_id()
         or (public.app_role() = 'supervisor' and site_id in (select public.app_my_sites())));
create policy policy_ack_read on public.policy_acknowledgements for select to authenticated
  using (public.app_role() in ('owner','manager') or worker_id = public.app_worker_id());
grant select on public.sick_ledger, public.sick_requests, public.policy_acknowledgements to authenticated;

create function public.app_sick_cfg() returns jsonb language sql stable security definer set search_path = public as
$$ select jsonb_build_object('waitDays', least(120, coalesce((data->'sick'->>'waitDays')::int, 120)),
     'plannedNoticeDays', least(7, coalesce((data->'sick'->>'plannedNoticeDays')::int, 7)),
     'yearBasis', coalesce(data->'sick'->>'yearBasis', 'calendar'),
     'policyVersion', coalesce((data->'sick'->>'policyVersion')::int, 1)) from public.settings where id = 1 $$;

-- Start of the benefit year containing d for this worker.
create function public.app_sick_year_start(p_worker uuid, d date) returns date language plpgsql stable security definer set search_path = public as
$$
declare v_basis text := public.app_sick_cfg()->>'yearBasis'; v_hire date; v_anniv date;
begin
  if v_basis = 'anniversary' then
    select coalesce(hire_date, created_at::date) into v_hire from public.workers where id = p_worker;
    if v_hire is not null then
      v_anniv := (v_hire + ((extract(year from d) - extract(year from v_hire))::int * interval '1 year'))::date;
      if v_anniv > d then v_anniv := (v_anniv - interval '1 year')::date; end if;
      return v_anniv;
    end if;
  end if;
  return date_trunc('year', d)::date;
end $$;

create function public.accrue_sick_for_punch(p_punch uuid) returns void language plpgsql security definer set search_path = public as
$$
declare v_p public.punches; v_h numeric;
begin
  select * into v_p from public.punches where id = p_punch and status = 'approved' and clock_out is not null;
  if not found then return; end if;
  v_h := greatest(0, extract(epoch from (v_p.clock_out - v_p.clock_in)) / 3600 - v_p.break_minutes / 60.0);
  insert into public.sick_ledger (worker_id, kind, hours, effective_on, punch_id, note, created_by)
  values (v_p.worker_id, 'accrual', round(v_h / 30.0, 3), v_p.clock_in::date, p_punch, 'Earned from a shift', null)
  on conflict (punch_id) where punch_id is not null do nothing;
end $$;

create function public.sick_balance(p_worker uuid, p_on date default current_date) returns jsonb
  language plpgsql stable security definer set search_path = public as
$$
declare v_ys date := public.app_sick_year_start(p_worker, p_on); v_cfg jsonb := public.app_sick_cfg(); v_st jsonb := public.employer_status(p_on);
        v_earned numeric; v_used numeric; v_carried numeric; v_all numeric; v_hire date; v_from date; v_cap numeric;
begin
  if public.app_role() = 'employee' and public.app_worker_id() is distinct from p_worker then raise exception 'You cannot see that balance.'; end if;
  select coalesce(sum(hours), 0) into v_earned from public.sick_ledger where worker_id = p_worker and kind = 'accrual' and effective_on >= v_ys and effective_on <= p_on;
  select coalesce(-sum(hours), 0) into v_used from public.sick_ledger where worker_id = p_worker and kind = 'use' and effective_on >= v_ys and effective_on <= p_on;
  select coalesce(sum(hours), 0) into v_carried from public.sick_ledger where worker_id = p_worker and kind in ('carryover','adjust','forfeit') and effective_on >= v_ys and effective_on <= p_on;
  select coalesce(sum(hours), 0) into v_all from public.sick_ledger where worker_id = p_worker and effective_on <= p_on;
  select coalesce(hire_date, created_at::date) into v_hire from public.workers where id = p_worker;
  v_from := v_hire + (v_cfg->>'waitDays')::int;
  v_cap := (v_st->>'sick_use_cap')::numeric;
  return jsonb_build_object('earned_year', round(v_earned, 2), 'used_year', round(v_used, 2), 'carried_in', round(v_carried, 2),
    'available', round(greatest(0, least(v_all, v_cap - v_used)), 2), 'use_cap', v_cap,
    'remaining_this_year', round(greatest(0, v_cap - v_used), 2), 'usable_from', v_from, 'year_start', v_ys);
end $$;

create function public.submit_sick_request(p_kind text, p_on date, p_hours numeric, p_reason text, p_shift_start timestamptz)
  returns public.sick_requests language plpgsql security definer set search_path = public as
$$
declare v_w uuid := public.app_worker_id(); v_cfg jsonb := public.app_sick_cfg(); v_bal jsonb; v_late boolean := false; v_row public.sick_requests; v_site uuid;
begin
  if v_w is null then raise exception 'Your login is not linked to a worker yet.'; end if;
  if p_kind not in ('planned','unplanned') then raise exception 'Unknown request type.'; end if;
  if p_hours is null or p_hours <= 0 or p_hours > 24 then raise exception 'Enter the hours you need, between 0.25 and 24.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Tell us briefly why you need the time.'; end if;
  v_bal := public.sick_balance(v_w, p_on);
  if p_on < (v_bal->>'usable_from')::date then raise exception 'You can start using sick time on %.', to_char((v_bal->>'usable_from')::date, 'Mon DD, YYYY'); end if;
  if p_hours > (v_bal->>'available')::numeric then raise exception 'You have % hours available for that date.', to_char((v_bal->>'available')::numeric, 'FM9990.00'); end if;
  if p_kind = 'planned' then
    if p_on < current_date + (v_cfg->>'plannedNoticeDays')::int then
      raise exception 'Planned sick time needs % days notice. The earliest date you can pick is %. If you are sick today, choose "Sick today" instead.',
        (v_cfg->>'plannedNoticeDays')::int, to_char(current_date + (v_cfg->>'plannedNoticeDays')::int, 'Mon DD');
    end if;
  else
    if p_on > current_date + 1 then raise exception 'Unplanned sick time is for today or tomorrow. Use a planned request for later dates.'; end if;
    v_late := p_shift_start is not null and now() > p_shift_start;
  end if;
  if exists (select 1 from public.sick_requests where worker_id = v_w and on_date = p_on and status in ('pending','approved')) then
    raise exception 'You already have a request for that date.'; end if;
  select site_id into v_site from public.site_assignments where worker_id = v_w limit 1;
  insert into public.sick_requests (worker_id, kind, on_date, hours, reason, shift_start, late, site_id)
  values (v_w, p_kind, p_on, p_hours, trim(p_reason), p_shift_start, v_late, v_site) returning * into v_row;
  return v_row;
end $$;

create function public.cancel_sick_request(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$
begin
  update public.sick_requests set status = 'cancelled' where id = p_id and worker_id = public.app_worker_id() and status = 'pending';
  if not found then raise exception 'Only your own pending requests can be cancelled.'; end if;
end $$;

create function public.decide_sick_request(p_id uuid, p_status text, p_note text) returns public.sick_requests
  language plpgsql security definer set search_path = public as
$$
declare v_r public.sick_requests; v_run int; v_row public.sick_requests; v_bal jsonb;
begin
  select * into v_r from public.sick_requests where id = p_id;
  if not found then raise exception 'Request not found.'; end if;
  if not public.app_can_manage_punch(v_r.worker_id, v_r.site_id) then raise exception 'You do not have access to this request.'; end if;
  if v_r.status <> 'pending' then raise exception 'This request was already decided.'; end if;
  if p_status not in ('approved','denied') then raise exception 'Unknown decision.'; end if;
  if p_status = 'denied' and coalesce(trim(p_note), '') = '' then raise exception 'Enter the reason for denying.'; end if;
  if p_status = 'approved' then
    v_bal := public.sick_balance(v_r.worker_id, v_r.on_date);
    if v_r.hours > (v_bal->>'available')::numeric then raise exception 'Only % hours are available on that date.', to_char((v_bal->>'available')::numeric, 'FM9990.00'); end if;
    select coalesce(max(consecutive_run), 0) + 1 into v_run from public.sick_requests
      where worker_id = v_r.worker_id and status = 'approved' and on_date = v_r.on_date - 1;
    insert into public.sick_ledger (worker_id, kind, hours, effective_on, request_id, note)
    values (v_r.worker_id, 'use', -v_r.hours, v_r.on_date, v_r.id, 'Sick time used');
  else v_run := 1; end if;
  update public.sick_requests set status = p_status, decided_by = auth.uid(), decided_at = now(), decision_note = coalesce(trim(p_note), ''), consecutive_run = v_run
   where id = p_id returning * into v_row;
  return v_row;
end $$;

create function public.request_documentation(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$
declare v_r public.sick_requests;
begin
  select * into v_r from public.sick_requests where id = p_id;
  if not found then raise exception 'Request not found.'; end if;
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can request documentation.'; end if;
  if v_r.status <> 'approved' or v_r.consecutive_run < 3 then raise exception 'Documentation can only be requested after 3 or more consecutive days of sick time.'; end if;
  update public.sick_requests set doc_requested_on = current_date, doc_due_on = current_date + 15 where id = p_id;
end $$;

create function public.mark_documentation_received(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can do that.'; end if;
  update public.sick_requests set doc_received_on = current_date where id = p_id and doc_requested_on is not null;
end $$;

create function public.ack_policy(p_version int, p_name text) returns void language plpgsql security definer set search_path = public as
$$
begin
  if public.app_worker_id() is null then raise exception 'Your login is not linked to a worker yet.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Type your name to sign.'; end if;
  insert into public.policy_acknowledgements (worker_id, policy_version, acknowledged_name) values (public.app_worker_id(), p_version, trim(p_name))
  on conflict do nothing;
end $$;

grant execute on function public.app_sick_cfg(), public.app_sick_year_start(uuid, date), public.accrue_sick_for_punch(uuid),
  public.sick_balance(uuid, date), public.submit_sick_request(text, date, numeric, text, timestamptz), public.cancel_sick_request(uuid),
  public.decide_sick_request(uuid, text, text), public.request_documentation(uuid), public.mark_documentation_received(uuid), public.ack_policy(int, text)
  to authenticated;

-- Accrue whenever a punch is (or becomes) approved with a clock-out.
create function public.punch_approved_accrue() returns trigger language plpgsql security definer set search_path = public as
$$ begin if new.status = 'approved' and new.clock_out is not null then perform public.accrue_sick_for_punch(new.id); end if; return null; end $$;
create trigger punches_accrue after insert or update of status, clock_in, clock_out, break_minutes on public.punches
  for each row execute function public.punch_approved_accrue();
-- ===== C. attendance, discipline, termination =====
create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  kind text not null check (kind in ('no_call_no_show','late_notice','unexcused','tardy')),
  on_date date not null,
  points numeric not null default 0,
  note text not null default '',
  expires_on date not null,
  created_by uuid default auth.uid(), created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index attendance_worker_idx on public.attendance_events (worker_id, on_date);
create table public.discipline_actions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  step_name text not null,
  points_at_time numeric not null default 0,
  reason text not null default '',
  issued_by uuid default auth.uid(), issued_by_name text not null default '',
  issued_at timestamptz not null default now(),
  worker_ack_at timestamptz, worker_ack_name text
);
alter table public.attendance_events enable row level security;
alter table public.discipline_actions enable row level security;
create policy attendance_read on public.attendance_events for select to authenticated
  using (public.app_role() in ('owner','manager') or worker_id = public.app_worker_id()
         or (public.app_role() = 'supervisor' and worker_id in (select worker_id from public.site_assignments where site_id in (select public.app_my_sites()))));
create policy discipline_read on public.discipline_actions for select to authenticated
  using (public.app_role() in ('owner','manager') or worker_id = public.app_worker_id());
grant select on public.attendance_events, public.discipline_actions to authenticated;

create function public.app_discipline_cfg() returns jsonb language sql stable security definer set search_path = public as
$$ select coalesce(data->'discipline', '{}'::jsonb) || jsonb_build_object(
     'pointValues', coalesce(data->'discipline'->'pointValues', '{"no_call_no_show":3,"late_notice":1,"unexcused":2,"tardy":0.5}'::jsonb),
     'pointsExpireDays', coalesce((data->'discipline'->>'pointsExpireDays')::int, 365)) from public.settings where id = 1 $$;

create function public.add_attendance_event(p_worker uuid, p_kind text, p_on date, p_note text) returns public.attendance_events
  language plpgsql security definer set search_path = public as
$$
declare v_cfg jsonb := public.app_discipline_cfg(); v_site uuid; v_row public.attendance_events; v_name text;
begin
  if p_kind not in ('no_call_no_show','late_notice','unexcused','tardy') then raise exception 'Unknown event type.'; end if;
  select site_id into v_site from public.site_assignments where worker_id = p_worker limit 1;
  if not public.app_can_manage_punch(p_worker, v_site) then raise exception 'You do not have access to this worker.'; end if;
  if exists (select 1 from public.sick_requests where worker_id = p_worker and on_date = p_on and status = 'approved') then
    raise exception 'That day is approved sick time. Attendance events cannot be recorded against it.'; end if;
  if p_kind = 'late_notice' and exists (select 1 from public.sick_requests where worker_id = p_worker and on_date = p_on and kind = 'unplanned' and status = 'pending' and not late) then
    raise exception 'That request was submitted before the shift started, so it is not late notice.'; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.attendance_events (worker_id, kind, on_date, points, note, expires_on, created_by_name)
  values (p_worker, p_kind, p_on, coalesce((v_cfg->'pointValues'->>p_kind)::numeric, 0), coalesce(trim(p_note), ''), p_on + (v_cfg->>'pointsExpireDays')::int, coalesce(v_name, ''))
  returning * into v_row;
  return v_row;
end $$;

create function public.delete_attendance_event(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can remove an attendance event.'; end if;
  delete from public.attendance_events where id = p_id;
end $$;

create function public.attendance_points(p_worker uuid, p_on date default current_date) returns numeric language sql stable security definer set search_path = public as
$$ select coalesce(sum(points), 0) from public.attendance_events where worker_id = p_worker and on_date <= p_on and expires_on > p_on $$;

create function public.issue_discipline(p_worker uuid, p_step text, p_reason text) returns public.discipline_actions
  language plpgsql security definer set search_path = public as
$$
declare v_row public.discipline_actions; v_name text;
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can issue a warning.'; end if;
  if coalesce(trim(p_step), '') = '' or coalesce(trim(p_reason), '') = '' then raise exception 'Choose a step and enter the reason.'; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.discipline_actions (worker_id, step_name, points_at_time, reason, issued_by_name)
  values (p_worker, trim(p_step), public.attendance_points(p_worker, current_date), trim(p_reason), coalesce(v_name, '')) returning * into v_row;
  return v_row;
end $$;

create function public.ack_discipline(p_id uuid, p_name text) returns void language plpgsql security definer set search_path = public as
$$
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'Type your name to sign.'; end if;
  update public.discipline_actions set worker_ack_at = now(), worker_ack_name = trim(p_name)
   where id = p_id and worker_id = public.app_worker_id() and worker_ack_at is null;
  if not found then raise exception 'Nothing to sign.'; end if;
end $$;

create function public.terminate_worker(p_worker uuid, p_on date, p_reason text) returns void language plpgsql security definer set search_path = public as
$$
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only an owner or manager can end employment.'; end if;
  if p_on is null then raise exception 'Enter the last day.'; end if;
  update public.punches set clock_out = now(), status = 'submitted' where worker_id = p_worker and status = 'open';
  update public.sick_requests set status = 'cancelled' where worker_id = p_worker and status = 'pending';
  update public.workers set terminated_on = p_on, termination_reason = coalesce(trim(p_reason), ''), archived = true where id = p_worker;
  update public.profiles set active = false where worker_id = p_worker and role <> 'owner';
end $$;

grant execute on function public.app_discipline_cfg(), public.add_attendance_event(uuid, text, date, text), public.delete_attendance_event(uuid),
  public.attendance_points(uuid, date), public.issue_discipline(uuid, text, text), public.ack_discipline(uuid, text), public.terminate_worker(uuid, date, text)
  to authenticated;
-- ===== D. weekly hours and clock-in cap =====
create function public.app_payroll_week_start(p_at timestamptz) returns date language plpgsql stable security definer set search_path = public as
$$
declare v_ws int; v_d date := (p_at at time zone 'America/Detroit')::date;
begin
  select coalesce((data->>'weekStart')::int, 0) into v_ws from public.settings where id = 1;
  return v_d - ((extract(dow from v_d)::int - v_ws + 7) % 7);
end $$;

create function public.week_hours(p_worker uuid, p_at timestamptz default now()) returns numeric language plpgsql stable security definer set search_path = public as
$$
declare v_ws date := public.app_payroll_week_start(p_at); v_h numeric;
begin
  select coalesce(sum(greatest(0, extract(epoch from (coalesce(clock_out, now()) - clock_in)) / 3600 - break_minutes / 60.0)), 0) into v_h
  from public.punches where worker_id = p_worker and status <> 'rejected'
    and (clock_in at time zone 'America/Detroit')::date >= v_ws and (clock_in at time zone 'America/Detroit')::date < v_ws + 7;
  return round(v_h, 2);
end $$;

create function public.effective_cap(p_worker uuid) returns jsonb language sql stable security definer set search_path = public as
$$ select jsonb_build_object(
     'cap', coalesce(w.weekly_cap, (s.data->'hours'->>'weeklyCap')::numeric, 40),
     'mode', coalesce(w.cap_mode, s.data->'hours'->>'capMode', 'warn'))
   from public.workers w, public.settings s where w.id = p_worker and s.id = 1 $$;

grant execute on function public.app_payroll_week_start(timestamptz), public.week_hours(uuid, timestamptz), public.effective_cap(uuid) to authenticated;

-- clock_in: same as schema.sql plus the weekly cap check.
create or replace function public.clock_in(p_site uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
  returns public.punches language plpgsql security definer set search_path = public as
$$
declare v_worker uuid := public.app_worker_id(); v_site public.sites; v_dist double precision; v_flag boolean := false;
        v_policy text; v_row public.punches; v_cap jsonb;
begin
  if v_worker is null then raise exception 'Your login is not linked to a worker yet. Ask a manager to finish your setup.'; end if;
  select * into v_site from public.sites where id = p_site and active;
  if not found then raise exception 'That site is not available.'; end if;
  if not exists (select 1 from public.site_assignments where site_id = p_site and worker_id = v_worker) then
    raise exception 'You are not assigned to %.', v_site.name; end if;
  if exists (select 1 from public.punches where worker_id = v_worker and status = 'open') then
    raise exception 'You are already clocked in.'; end if;
  v_cap := public.effective_cap(v_worker);
  if v_cap->>'mode' = 'block' and public.week_hours(v_worker, now()) >= (v_cap->>'cap')::numeric then
    raise exception 'You have reached your weekly hours cap of % hours. Ask a manager if you need to work more.', (v_cap->>'cap')::numeric;
  end if;
  select coalesce(data->>'outsidePolicy', 'block') into v_policy from public.settings where id = 1;
  if v_site.lat is not null and v_site.lng is not null then
    if p_lat is null or p_lng is null then
      v_flag := true;
      if v_policy = 'block' then raise exception 'Location is needed to clock in. Allow location for this app and try again.'; end if;
    else
      v_dist := public.app_distance_m(p_lat, p_lng, v_site.lat, v_site.lng);
      v_flag := v_dist > v_site.radius_m;
      if v_flag and v_policy = 'block' then
        raise exception 'You are about % meters from %. Clock in when you are on site.', round(v_dist), v_site.name; end if;
    end if;
  end if;
  insert into public.punches (worker_id, site_id, clock_in, status, in_lat, in_lng, in_accuracy_m, in_distance_m, in_flagged)
  values (v_worker, p_site, now(), 'open', p_lat, p_lng, p_accuracy, v_dist, v_flag) returning * into v_row;
  return v_row;
end $$;
-- ===== E. sick pay on paychecks =====
alter table public.paychecks add column sick_hours numeric not null default 0;
alter table public.sick_requests add column paycheck_id uuid references public.paychecks(id) on delete set null;
create function public.attach_sick(p_paycheck uuid, p_ids uuid[]) returns int language plpgsql security definer set search_path = public as
$$
declare v_n int;
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can run payroll.'; end if;
  update public.sick_requests r set paycheck_id = p_paycheck where r.id = any(p_ids) and r.status = 'approved' and r.paycheck_id is null
    and r.worker_id = (select worker_id from public.paychecks where id = p_paycheck);
  get diagnostics v_n = row_count; return v_n;
end $$;
grant execute on function public.attach_sick(uuid, uuid[]) to authenticated;

-- ===== Administrator flag =====
-- An administrator has every owner power plus the right to assign owners and other administrators.
alter table public.profiles add column is_admin boolean not null default false;

create or replace function public.app_role() returns text
  language sql stable security definer set search_path = public as
$$ select case when is_admin then 'owner' else role end from public.profiles where id = auth.uid() and active $$;

create function public.app_is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from public.profiles where id = auth.uid() and active), false) $$;

create or replace function public.set_profile(p_id uuid, p_role text, p_active boolean, p_worker uuid)
  returns public.profiles language plpgsql security definer set search_path = public as
$$
declare v_me text := public.app_role(); v_admin boolean := public.app_is_admin(); v_t public.profiles; v_row public.profiles;
begin
  if v_me is null or v_me not in ('owner','manager') then raise exception 'Only an owner or manager can manage people.'; end if;
  if p_role not in ('owner','manager','supervisor','employee') then raise exception 'Unknown role.'; end if;
  select * into v_t from public.profiles where id = p_id;
  if not found then raise exception 'Person not found.'; end if;
  if v_t.is_admin and not v_admin then raise exception 'Only an administrator can change an administrator.'; end if;
  if v_me = 'manager' and (v_t.role in ('owner','manager') or p_role in ('owner','manager')) then
    raise exception 'Only an owner can change owners and managers.'; end if;
  if v_t.role = 'owner' and v_t.active and (p_role <> 'owner' or not p_active)
     and (select count(*) from public.profiles where (role = 'owner' or is_admin) and active) <= 1 then
    raise exception 'There must be at least one active owner or administrator.'; end if;
  if p_worker is not null and exists (select 1 from public.profiles where worker_id = p_worker and id <> p_id) then
    raise exception 'That worker is already linked to another login.'; end if;
  update public.profiles set role = p_role, active = p_active, worker_id = p_worker where id = p_id returning * into v_row;
  return v_row;
end $$;

create function public.set_admin(p_id uuid, p_admin boolean) returns public.profiles
  language plpgsql security definer set search_path = public as
$$
declare v_row public.profiles;
begin
  if not public.app_is_admin() then raise exception 'Only an administrator can grant or remove administrator access.'; end if;
  if not p_admin and p_id = auth.uid() and (select count(*) from public.profiles where is_admin and active) <= 1 then
    raise exception 'You are the only administrator. Make someone else an administrator first.'; end if;
  update public.profiles set is_admin = p_admin where id = p_id returning * into v_row;
  if not found then raise exception 'Person not found.'; end if;
  return v_row;
end $$;

grant execute on function public.app_is_admin(), public.set_admin(uuid, boolean) to authenticated;

-- Bootstrap: the tech owner is the first administrator.
update public.profiles set is_admin = true, active = true where email = 'antonio.gholson@icloud.com';
-- ===== Site checklists =====
create table public.site_tasks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index site_tasks_site_idx on public.site_tasks (site_id, sort_order);

-- One row per task ticked on a given shift. Deleting the row unticks it.
create table public.task_checks (
  punch_id uuid not null references public.punches(id) on delete cascade,
  task_id uuid not null references public.site_tasks(id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (punch_id, task_id)
);

alter table public.site_tasks enable row level security;
alter table public.task_checks enable row level security;
create policy site_tasks_read on public.site_tasks for select to authenticated using (public.app_role() is not null);
create policy site_tasks_write on public.site_tasks for all to authenticated
  using (public.app_role() in ('owner','manager')) with check (public.app_role() in ('owner','manager'));
create policy task_checks_read on public.task_checks for select to authenticated
  using (exists (select 1 from public.punches p where p.id = punch_id));   -- punches RLS already limits who sees which shift
grant select, insert, update, delete on public.site_tasks to authenticated;
grant select on public.task_checks to authenticated;

-- Only the worker on that open shift can tick or untick its tasks.
create function public.set_task_done(p_punch uuid, p_task uuid, p_done boolean) returns void
  language plpgsql security definer set search_path = public as
$$
declare v_p public.punches;
begin
  select * into v_p from public.punches where id = p_punch;
  if not found or v_p.worker_id is distinct from public.app_worker_id() then raise exception 'That shift is not yours.'; end if;
  if v_p.status <> 'open' then raise exception 'Tasks can only be checked while you are clocked in.'; end if;
  if not exists (select 1 from public.site_tasks where id = p_task and site_id = v_p.site_id and active) then raise exception 'That task is not on this site.'; end if;
  if p_done then insert into public.task_checks (punch_id, task_id) values (p_punch, p_task) on conflict do nothing;
  else delete from public.task_checks where punch_id = p_punch and task_id = p_task; end if;
end $$;
grant execute on function public.set_task_done(uuid, uuid, boolean) to authenticated;
-- ===== Photo or video proof on checklist tasks =====
alter table public.site_tasks
  add column proof text not null default 'none' check (proof in ('none','photo','video','either')),
  add column proof_required boolean not null default false;
alter table public.task_checks
  add column proof_path text,
  add column proof_type text check (proof_type is null or proof_type in ('photo','video'));

-- Private bucket. Files live at <punch id>/<task id>.<ext>. 60 MB cap so short phone videos fit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof', 'proof', false, 62914560, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm','video/3gpp'])
on conflict (id) do nothing;

-- The worker on the open shift may upload into that shift's folder. Anyone who can see the shift may view its files.
create policy proof_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'proof' and exists (select 1 from public.punches p where p.id::text = (storage.foldername(name))[1] and p.worker_id = public.app_worker_id() and p.status = 'open'));
create policy proof_replace on storage.objects for update to authenticated
  using (bucket_id = 'proof' and exists (select 1 from public.punches p where p.id::text = (storage.foldername(name))[1] and p.worker_id = public.app_worker_id() and p.status = 'open'));
create policy proof_view on storage.objects for select to authenticated
  using (bucket_id = 'proof' and exists (select 1 from public.punches p where p.id::text = (storage.foldername(name))[1]));

drop function public.set_task_done(uuid, uuid, boolean);
create function public.set_task_done(p_punch uuid, p_task uuid, p_done boolean, p_proof_path text default null, p_proof_type text default null) returns void
  language plpgsql security definer set search_path = public as
$$
declare v_p public.punches; v_t public.site_tasks;
begin
  select * into v_p from public.punches where id = p_punch;
  if not found or v_p.worker_id is distinct from public.app_worker_id() then raise exception 'That shift is not yours.'; end if;
  if v_p.status <> 'open' then raise exception 'Tasks can only be checked while you are clocked in.'; end if;
  select * into v_t from public.site_tasks where id = p_task and site_id = v_p.site_id and active;
  if not found then raise exception 'That task is not on this site.'; end if;
  if p_done then
    if v_t.proof_required and p_proof_path is null then
      raise exception 'This task needs a % before it can be checked off.', case v_t.proof when 'photo' then 'photo' when 'video' then 'video' else 'photo or video' end; end if;
    if p_proof_type is not null and v_t.proof <> 'either' and v_t.proof <> p_proof_type then raise exception 'This task asks for a %.', v_t.proof; end if;
    insert into public.task_checks (punch_id, task_id, proof_path, proof_type) values (p_punch, p_task, p_proof_path, p_proof_type)
    on conflict (punch_id, task_id) do update set proof_path = coalesce(excluded.proof_path, public.task_checks.proof_path), proof_type = coalesce(excluded.proof_type, public.task_checks.proof_type), checked_at = now();
  else delete from public.task_checks where punch_id = p_punch and task_id = p_task; end if;
end $$;
grant execute on function public.set_task_done(uuid, uuid, boolean, text, text) to authenticated;
-- ===== Scheduling and guaranteed hours =====
alter table public.sites
  add column sched_type text not null default 'fixed' check (sched_type in ('fixed','window')),
  add column default_start time,
  add column window_open time,
  add column window_due time,
  add column default_hours numeric not null default 0 check (default_hours >= 0 and default_hours <= 24),
  add column guarantee boolean not null default true,
  add column requires_tasks boolean not null default false;

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  on_date date not null,
  kind text not null check (kind in ('fixed','window')),
  start_at timestamptz,
  window_open timestamptz,
  window_due timestamptz,
  planned_hours numeric not null check (planned_hours > 0 and planned_hours <= 24),
  guarantee boolean not null default true,
  requires_tasks boolean not null default false,
  series_id uuid,
  status text not null default 'scheduled' check (status in ('scheduled','done','missed','sick','cancelled')),
  punch_id uuid references public.punches(id) on delete set null,
  note text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index shifts_worker_idx on public.shifts (worker_id, on_date);
create index shifts_date_idx on public.shifts (on_date);

alter table public.punches
  add column shift_id uuid references public.shifts(id) on delete set null,
  add column planned_hours numeric,
  add column paid_hours numeric,
  add column started_late boolean not null default false,
  add column finished_late boolean not null default false;
alter table public.paychecks add column guarantee_hours numeric not null default 0;

alter table public.shifts enable row level security;
create policy shifts_read on public.shifts for select to authenticated
  using (public.app_role() in ('owner','manager') or worker_id = public.app_worker_id()
         or (public.app_role() = 'supervisor' and site_id in (select public.app_my_sites())));
grant select on public.shifts to authenticated;

-- Worked hours of a punch (net of break).
create function public.app_worked_hours(p public.punches) returns numeric language sql immutable as
$$ select case when p.clock_out is null then null else round(greatest(0, extract(epoch from (p.clock_out - p.clock_in)) / 3600 - p.break_minutes / 60.0), 2) end $$;

-- The guaranteed-hours rule: max(worked, planned) when linked, guaranteed, and (if required) all required tasks are ticked.
create function public.app_paid_hours(p public.punches) returns numeric language plpgsql stable security definer set search_path = public as
$$
declare v_worked numeric := public.app_worked_hours(p); v_s public.shifts; v_ok boolean := true;
begin
  if v_worked is null then return null; end if;
  if p.shift_id is null then return v_worked; end if;
  select * into v_s from public.shifts where id = p.shift_id;
  if not found or not v_s.guarantee then return v_worked; end if;
  if v_s.requires_tasks then
    select not exists (select 1 from public.site_tasks t where t.site_id = p.site_id and t.active and t.proof_required
                       and not exists (select 1 from public.task_checks c where c.punch_id = p.id and c.task_id = t.id)) into v_ok;
  end if;
  return case when v_ok then greatest(v_worked, v_s.planned_hours) else v_worked end;
end $$;

-- Derived punch fields, kept in one place so clock-out, manual edits and added hours all agree.
create function public.punch_derive() returns trigger language plpgsql security definer set search_path = public as
$$
declare v_s public.shifts;
begin
  if new.shift_id is not null then
    select * into v_s from public.shifts where id = new.shift_id;
    if found then
      new.planned_hours := v_s.planned_hours;
      if v_s.kind = 'window' then
        new.started_late := (v_s.window_due - new.clock_in) < (v_s.planned_hours * interval '1 hour');
        new.finished_late := new.clock_out is not null and new.clock_out > v_s.window_due;
      end if;
    end if;
  end if;
  new.paid_hours := public.app_paid_hours(new);
  return new;
end $$;
create trigger punches_derive before insert or update of clock_in, clock_out, break_minutes, shift_id, status on public.punches
  for each row execute function public.punch_derive();

create function public.punch_shift_sync() returns trigger language plpgsql security definer set search_path = public as
$$
begin
  if new.shift_id is not null then
    update public.shifts set punch_id = new.id, status = case when new.clock_out is null then 'scheduled' else 'done' end
     where id = new.shift_id and status in ('scheduled','done','missed');
  end if;
  return null;
end $$;
create trigger punches_shift_sync after insert or update of clock_out, shift_id on public.punches
  for each row execute function public.punch_shift_sync();

-- Find the scheduled shift a clock-in belongs to. Fixed: 2 h before to 4 h after start. Window: between open and due.
create function public.app_match_shift(p_worker uuid, p_site uuid, p_at timestamptz) returns public.shifts
  language sql stable security definer set search_path = public as
$$ select * from public.shifts s where s.worker_id = p_worker and s.site_id = p_site and s.status in ('scheduled','missed') and s.punch_id is null
     and ((s.kind = 'fixed' and p_at between s.start_at - interval '2 hours' and s.start_at + interval '4 hours')
       or (s.kind = 'window' and p_at between s.window_open and s.window_due))
   order by coalesce(s.start_at, s.window_open) limit 1 $$;

create or replace function public.clock_in(p_site uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
  returns public.punches language plpgsql security definer set search_path = public as
$$
declare v_worker uuid := public.app_worker_id(); v_site public.sites; v_dist double precision; v_flag boolean := false;
        v_policy text; v_row public.punches; v_cap jsonb; v_shift public.shifts; v_next public.shifts;
begin
  if v_worker is null then raise exception 'Your login is not linked to a worker yet. Ask a manager to finish your setup.'; end if;
  select * into v_site from public.sites where id = p_site and active;
  if not found then raise exception 'That site is not available.'; end if;
  if not exists (select 1 from public.site_assignments where site_id = p_site and worker_id = v_worker) then
    raise exception 'You are not assigned to %.', v_site.name; end if;
  if exists (select 1 from public.punches where worker_id = v_worker and status = 'open') then
    raise exception 'You are already clocked in.'; end if;
  v_cap := public.effective_cap(v_worker);
  if v_cap->>'mode' = 'block' and public.week_hours(v_worker, now()) >= (v_cap->>'cap')::numeric then
    raise exception 'You have reached your weekly hours cap of % hours. Ask a manager if you need to work more.', (v_cap->>'cap')::numeric;
  end if;
  v_shift := public.app_match_shift(v_worker, p_site, now());
  if v_shift.id is null then
    -- A window shift later today that has not opened yet: wait for it.
    select * into v_next from public.shifts s where s.worker_id = v_worker and s.site_id = p_site and s.status = 'scheduled' and s.kind = 'window'
      and s.window_open > now() and s.window_open < now() + interval '12 hours' order by s.window_open limit 1;
    if found then raise exception 'This site opens at %. Clock in after that.', to_char(v_next.window_open at time zone 'America/Detroit', 'FMHH:MI PM'); end if;
  end if;
  select coalesce(data->>'outsidePolicy', 'block') into v_policy from public.settings where id = 1;
  if v_site.lat is not null and v_site.lng is not null then
    if p_lat is null or p_lng is null then
      v_flag := true;
      if v_policy = 'block' then raise exception 'Location is needed to clock in. Allow location for this app and try again.'; end if;
    else
      v_dist := public.app_distance_m(p_lat, p_lng, v_site.lat, v_site.lng);
      v_flag := v_dist > v_site.radius_m;
      if v_flag and v_policy = 'block' then
        raise exception 'You are about % meters from %. Clock in when you are on site.', round(v_dist), v_site.name; end if;
    end if;
  end if;
  insert into public.punches (worker_id, site_id, clock_in, status, in_lat, in_lng, in_accuracy_m, in_distance_m, in_flagged, shift_id)
  values (v_worker, p_site, now(), 'open', p_lat, p_lng, p_accuracy, v_dist, v_flag, v_shift.id) returning * into v_row;
  return v_row;
end $$;

-- Times are Detroit local. A window that ends at or before it opens rolls to the next day.
create function public.schedule_shift(p_worker uuid, p_site uuid, p_on date, p_kind text, p_start time, p_open time, p_due time,
    p_planned numeric, p_guarantee boolean, p_requires_tasks boolean, p_repeat_weeks int, p_note text)
  returns setof public.shifts language plpgsql security definer set search_path = public as
$$
declare v_series uuid := gen_random_uuid(); v_d date; v_i int; v_row public.shifts; v_open timestamptz; v_due timestamptz;
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can schedule shifts.'; end if;
  if p_kind not in ('fixed','window') then raise exception 'Choose a shift type.'; end if;
  if p_planned is null or p_planned <= 0 then raise exception 'Enter the planned hours.'; end if;
  if p_kind = 'fixed' and p_start is null then raise exception 'Enter the start time.'; end if;
  if p_kind = 'window' and (p_open is null or p_due is null) then raise exception 'Enter when the site opens and when the work is due.'; end if;
  if not exists (select 1 from public.site_assignments where site_id = p_site and worker_id = p_worker) then
    insert into public.site_assignments (site_id, worker_id) values (p_site, p_worker); end if;
  for v_i in 0 .. greatest(0, least(coalesce(p_repeat_weeks, 1), 26) - 1) loop
    v_d := p_on + (v_i * 7);
    if p_kind = 'window' then
      v_open := (v_d + p_open) at time zone 'America/Detroit';
      v_due := (v_d + p_due) at time zone 'America/Detroit';
      if v_due <= v_open then v_due := v_due + interval '1 day'; end if;
    end if;
    insert into public.shifts (worker_id, site_id, on_date, kind, start_at, window_open, window_due, planned_hours, guarantee, requires_tasks, series_id, note)
    values (p_worker, p_site, v_d, p_kind, case when p_kind = 'fixed' then (v_d + p_start) at time zone 'America/Detroit' end, v_open, v_due,
            p_planned, coalesce(p_guarantee, true), coalesce(p_requires_tasks, false), v_series, coalesce(trim(p_note), ''))
    returning * into v_row;
    return next v_row;
  end loop;
end $$;

create function public.cancel_shift(p_id uuid, p_series boolean) returns int language plpgsql security definer set search_path = public as
$$
declare v_s public.shifts; v_n int;
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can cancel shifts.'; end if;
  select * into v_s from public.shifts where id = p_id;
  if not found then raise exception 'Shift not found.'; end if;
  if p_series and v_s.series_id is not null then
    update public.shifts set status = 'cancelled' where series_id = v_s.series_id and status = 'scheduled' and on_date >= v_s.on_date;
  else update public.shifts set status = 'cancelled' where id = p_id and status = 'scheduled'; end if;
  get diagnostics v_n = row_count; return v_n;
end $$;

-- Mark missed and sick-covered shifts. Idempotent; managers call it on every load.
create function public.sweep_shifts() returns int language plpgsql security definer set search_path = public as
$$
declare v_n int;
begin
  update public.shifts s set status = 'sick' where s.status in ('scheduled','missed') and s.punch_id is null
    and exists (select 1 from public.sick_requests r where r.worker_id = s.worker_id and r.on_date = s.on_date and r.status = 'approved');
  update public.shifts s set status = 'missed' where s.status = 'scheduled' and s.punch_id is null
    and ((s.kind = 'fixed' and now() > s.start_at + interval '4 hours') or (s.kind = 'window' and now() > s.window_due));
  get diagnostics v_n = row_count; return v_n;
end $$;

grant execute on function public.app_worked_hours(public.punches), public.app_paid_hours(public.punches), public.app_match_shift(uuid, uuid, timestamptz),
  public.schedule_shift(uuid, uuid, date, text, time, time, time, numeric, boolean, boolean, int, text), public.cancel_shift(uuid, boolean), public.sweep_shifts()
  to authenticated;
-- ===== Piece 2: identity data for tax forms, SSN encrypted =====
-- SSNs are encrypted with a key held in Supabase Vault. Only owners and administrators can decrypt, only through
-- get_worker_ssn(), and every reveal is logged. Managers and supervisors see the last four digits at most.
create extension if not exists pgcrypto with schema extensions;

create table public.worker_private (
  worker_id uuid primary key references public.workers(id) on delete cascade,
  legal_first text not null default '',
  legal_middle text not null default '',
  legal_last text not null default '',
  street text not null default '',
  street2 text not null default '',
  city text not null default '',
  state text not null default 'MI',
  zip text not null default '',
  ssn_enc bytea,
  ssn_last4 text,
  home_city text not null default 'none',        -- Michigan city income tax code, piece 3
  w4_signed_at timestamptz, w4_signed_name text, w4_year int,
  updated_by uuid, updated_at timestamptz not null default now()
);
alter table public.worker_private enable row level security;
-- No direct reads. Everything goes through the functions below.
revoke all on public.worker_private from authenticated, anon;

create table public.pii_access_log (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null,
  by_user uuid not null default auth.uid(),
  by_name text not null default '',
  purpose text not null default '',
  at timestamptz not null default now()
);
alter table public.pii_access_log enable row level security;
create policy pii_log_read on public.pii_access_log for select to authenticated using (public.app_is_admin() or public.app_role() = 'owner');
grant select on public.pii_access_log to authenticated;

create function public.app_pii_key() returns text language sql stable security definer set search_path = public as
$$ select decrypted_secret from vault.decrypted_secrets where name = 'app_pii_key' limit 1 $$;
revoke execute on function public.app_pii_key() from public, anon, authenticated;

create function public.app_valid_ssn(p text) returns text language plpgsql immutable as
$$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d = '' then return null; end if;
  if length(d) <> 9 or d ~ '^(000|666|9)' or substr(d, 4, 2) = '00' or substr(d, 6, 4) = '0000' then
    raise exception 'That does not look like a valid Social Security number.'; end if;
  return d;
end $$;

-- Employee fills in their own paperwork (address, SSN, W-4) from their phone.
create function public.submit_paperwork(p_first text, p_middle text, p_last text, p_street text, p_street2 text, p_city text, p_state text, p_zip text,
    p_ssn text, p_home_city text, p_filing text, p_step2 boolean, p_dependents numeric, p_extra numeric, p_other_income numeric, p_deductions numeric,
    p_mi_exemptions numeric, p_sign_name text)
  returns void language plpgsql security definer set search_path = public as
$$
declare v_w uuid := public.app_worker_id(); v_ssn text := public.app_valid_ssn(p_ssn); v_key text;
begin
  if v_w is null then raise exception 'Your login is not linked to a worker yet.'; end if;
  if coalesce(trim(p_first), '') = '' or coalesce(trim(p_last), '') = '' then raise exception 'Enter your legal first and last name.'; end if;
  if coalesce(trim(p_street), '') = '' or coalesce(trim(p_city), '') = '' or coalesce(trim(p_zip), '') = '' then raise exception 'Enter your home address.'; end if;
  if p_filing not in ('Single','MFJ','HOH') then raise exception 'Choose a filing status.'; end if;
  if coalesce(trim(p_sign_name), '') = '' then raise exception 'Type your name to sign the W-4.'; end if;
  v_key := public.app_pii_key();
  if v_key is null then raise exception 'The encryption key is not set up. Ask the administrator.'; end if;
  insert into public.worker_private as wp (worker_id, legal_first, legal_middle, legal_last, street, street2, city, state, zip, ssn_enc, ssn_last4, home_city,
      w4_signed_at, w4_signed_name, w4_year, updated_by)
  values (v_w, trim(p_first), coalesce(trim(p_middle), ''), trim(p_last), trim(p_street), coalesce(trim(p_street2), ''), trim(p_city), upper(coalesce(p_state, 'MI')), trim(p_zip),
      case when v_ssn is null then null else extensions.pgp_sym_encrypt(v_ssn, v_key) end, case when v_ssn is null then null else right(v_ssn, 4) end,
      coalesce(p_home_city, 'none'), now(), trim(p_sign_name), extract(year from now())::int, auth.uid())
  on conflict (worker_id) do update set legal_first = excluded.legal_first, legal_middle = excluded.legal_middle, legal_last = excluded.legal_last,
      street = excluded.street, street2 = excluded.street2, city = excluded.city, state = excluded.state, zip = excluded.zip,
      ssn_enc = coalesce(excluded.ssn_enc, wp.ssn_enc), ssn_last4 = coalesce(excluded.ssn_last4, wp.ssn_last4), home_city = excluded.home_city,
      w4_signed_at = now(), w4_signed_name = excluded.w4_signed_name, w4_year = excluded.w4_year, updated_by = auth.uid(), updated_at = now();
  update public.workers set filing = p_filing, step2 = coalesce(p_step2, false), dependents_credit = coalesce(p_dependents, 0), extra_withholding = coalesce(p_extra, 0),
      other_income = coalesce(p_other_income, 0), deductions = coalesce(p_deductions, 0), mi_exemptions = coalesce(p_mi_exemptions, 0) where id = v_w;
end $$;

-- Owner or manager edits address and city for a worker; SSN only by owner or administrator.
create function public.set_worker_private(p_worker uuid, p_first text, p_middle text, p_last text, p_street text, p_street2 text, p_city text, p_state text, p_zip text, p_ssn text, p_home_city text)
  returns void language plpgsql security definer set search_path = public as
$$
declare v_ssn text := public.app_valid_ssn(p_ssn); v_key text;
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only an owner or manager can edit worker details.'; end if;
  if v_ssn is not null and not (public.app_role() = 'owner') then raise exception 'Only an owner or administrator can enter a Social Security number.'; end if;
  v_key := public.app_pii_key();
  insert into public.worker_private as wp (worker_id, legal_first, legal_middle, legal_last, street, street2, city, state, zip, ssn_enc, ssn_last4, home_city, updated_by)
  values (p_worker, coalesce(trim(p_first), ''), coalesce(trim(p_middle), ''), coalesce(trim(p_last), ''), coalesce(trim(p_street), ''), coalesce(trim(p_street2), ''), coalesce(trim(p_city), ''),
      upper(coalesce(p_state, 'MI')), coalesce(trim(p_zip), ''), case when v_ssn is null then null else extensions.pgp_sym_encrypt(v_ssn, v_key) end, case when v_ssn is null then null else right(v_ssn, 4) end, coalesce(p_home_city, 'none'), auth.uid())
  on conflict (worker_id) do update set legal_first = excluded.legal_first, legal_middle = excluded.legal_middle, legal_last = excluded.legal_last,
      street = excluded.street, street2 = excluded.street2, city = excluded.city, state = excluded.state, zip = excluded.zip,
      ssn_enc = coalesce(excluded.ssn_enc, wp.ssn_enc), ssn_last4 = coalesce(excluded.ssn_last4, wp.ssn_last4), home_city = excluded.home_city, updated_by = auth.uid(), updated_at = now();
end $$;

-- Everything except the SSN. Owner and manager for anyone; a worker for themselves.
create function public.worker_details(p_worker uuid) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v jsonb;
begin
  if not (public.app_role() in ('owner','manager') or public.app_worker_id() = p_worker) then raise exception 'No access.'; end if;
  select jsonb_build_object('legal_first', legal_first, 'legal_middle', legal_middle, 'legal_last', legal_last, 'street', street, 'street2', street2, 'city', city, 'state', state, 'zip', zip,
    'ssn_last4', ssn_last4, 'has_ssn', ssn_enc is not null, 'home_city', home_city, 'w4_signed_at', w4_signed_at, 'w4_signed_name', w4_signed_name, 'w4_year', w4_year)
  into v from public.worker_private where worker_id = p_worker;
  return coalesce(v, '{}'::jsonb);
end $$;

-- Full SSN, owner or administrator only, logged every time. p_purpose says which form needed it.
create function public.get_worker_ssn(p_worker uuid, p_purpose text) returns text language plpgsql security definer set search_path = public as
$$
declare v bytea; v_name text;
begin
  if public.app_role() <> 'owner' then raise exception 'Only an owner or administrator can view a Social Security number.'; end if;
  select ssn_enc into v from public.worker_private where worker_id = p_worker;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.pii_access_log (worker_id, by_name, purpose) values (p_worker, coalesce(v_name, ''), coalesce(p_purpose, ''));
  return case when v is null then null else extensions.pgp_sym_decrypt(v, public.app_pii_key()) end;
end $$;

-- All SSNs at once for a year-end run, one log line per worker.
create function public.get_all_ssns(p_purpose text) returns table (worker_id uuid, ssn text) language plpgsql security definer set search_path = public as
$$
declare v_name text; v_key text := public.app_pii_key();
begin
  if public.app_role() <> 'owner' then raise exception 'Only an owner or administrator can view Social Security numbers.'; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.pii_access_log (worker_id, by_name, purpose) select wp.worker_id, coalesce(v_name, ''), coalesce(p_purpose, '') from public.worker_private wp where wp.ssn_enc is not null;
  return query select wp.worker_id, extensions.pgp_sym_decrypt(wp.ssn_enc, v_key) from public.worker_private wp where wp.ssn_enc is not null;
end $$;

grant execute on function public.app_valid_ssn(text), public.worker_details(uuid), public.get_worker_ssn(uuid, text), public.get_all_ssns(text),
  public.submit_paperwork(text, text, text, text, text, text, text, text, text, text, text, boolean, numeric, numeric, numeric, numeric, numeric, text),
  public.set_worker_private(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- Wage bases the forms need, stored per paycheck so year-end totals are exact.
alter table public.paychecks add column ss_wages numeric not null default 0, add column med_wages numeric not null default 0, add column city_detail jsonb not null default '{}'::jsonb;
update public.paychecks set ss_wages = round(ss / 0.062, 2), med_wages = case when type = 'W-2' then gross else 0 end where type = 'W-2' and ss_wages = 0;
-- ===== Piece 3: Michigan city income tax by home city and work city =====
alter table public.workers add column home_city text not null default 'none';
alter table public.sites add column city text not null default 'none';
-- Best guess from the old single-rate field: a 2.4% rate meant a Detroit resident.
update public.workers set home_city = 'detroit' where city_rate = 0.024;
update public.workers set home_city = 'highland_park' where city_rate = 0.02;

-- Keep workers.home_city in step with what the worker enters in their paperwork.
create or replace function public.submit_paperwork(p_first text, p_middle text, p_last text, p_street text, p_street2 text, p_city text, p_state text, p_zip text,
    p_ssn text, p_home_city text, p_filing text, p_step2 boolean, p_dependents numeric, p_extra numeric, p_other_income numeric, p_deductions numeric,
    p_mi_exemptions numeric, p_sign_name text)
  returns void language plpgsql security definer set search_path = public as
$$
declare v_w uuid := public.app_worker_id(); v_ssn text := public.app_valid_ssn(p_ssn); v_key text;
begin
  if v_w is null then raise exception 'Your login is not linked to a worker yet.'; end if;
  if coalesce(trim(p_first), '') = '' or coalesce(trim(p_last), '') = '' then raise exception 'Enter your legal first and last name.'; end if;
  if coalesce(trim(p_street), '') = '' or coalesce(trim(p_city), '') = '' or coalesce(trim(p_zip), '') = '' then raise exception 'Enter your home address.'; end if;
  if p_filing not in ('Single','MFJ','HOH') then raise exception 'Choose a filing status.'; end if;
  if coalesce(trim(p_sign_name), '') = '' then raise exception 'Type your name to sign the W-4.'; end if;
  v_key := public.app_pii_key();
  if v_key is null then raise exception 'The encryption key is not set up. Ask the administrator.'; end if;
  insert into public.worker_private as wp (worker_id, legal_first, legal_middle, legal_last, street, street2, city, state, zip, ssn_enc, ssn_last4, home_city,
      w4_signed_at, w4_signed_name, w4_year, updated_by)
  values (v_w, trim(p_first), coalesce(trim(p_middle), ''), trim(p_last), trim(p_street), coalesce(trim(p_street2), ''), trim(p_city), upper(coalesce(p_state, 'MI')), trim(p_zip),
      case when v_ssn is null then null else extensions.pgp_sym_encrypt(v_ssn, v_key) end, case when v_ssn is null then null else right(v_ssn, 4) end,
      coalesce(p_home_city, 'none'), now(), trim(p_sign_name), extract(year from now())::int, auth.uid())
  on conflict (worker_id) do update set legal_first = excluded.legal_first, legal_middle = excluded.legal_middle, legal_last = excluded.legal_last,
      street = excluded.street, street2 = excluded.street2, city = excluded.city, state = excluded.state, zip = excluded.zip,
      ssn_enc = coalesce(excluded.ssn_enc, wp.ssn_enc), ssn_last4 = coalesce(excluded.ssn_last4, wp.ssn_last4), home_city = excluded.home_city,
      w4_signed_at = now(), w4_signed_name = excluded.w4_signed_name, w4_year = excluded.w4_year, updated_by = auth.uid(), updated_at = now();
  update public.workers set filing = p_filing, step2 = coalesce(p_step2, false), dependents_credit = coalesce(p_dependents, 0), extra_withholding = coalesce(p_extra, 0),
      other_income = coalesce(p_other_income, 0), deductions = coalesce(p_deductions, 0), mi_exemptions = coalesce(p_mi_exemptions, 0), home_city = coalesce(p_home_city, 'none') where id = v_w;
end $$;

create or replace function public.set_worker_private(p_worker uuid, p_first text, p_middle text, p_last text, p_street text, p_street2 text, p_city text, p_state text, p_zip text, p_ssn text, p_home_city text)
  returns void language plpgsql security definer set search_path = public as
$$
declare v_ssn text := public.app_valid_ssn(p_ssn); v_key text;
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only an owner or manager can edit worker details.'; end if;
  if v_ssn is not null and not (public.app_role() = 'owner') then raise exception 'Only an owner or administrator can enter a Social Security number.'; end if;
  v_key := public.app_pii_key();
  insert into public.worker_private as wp (worker_id, legal_first, legal_middle, legal_last, street, street2, city, state, zip, ssn_enc, ssn_last4, home_city, updated_by)
  values (p_worker, coalesce(trim(p_first), ''), coalesce(trim(p_middle), ''), coalesce(trim(p_last), ''), coalesce(trim(p_street), ''), coalesce(trim(p_street2), ''), coalesce(trim(p_city), ''),
      upper(coalesce(p_state, 'MI')), coalesce(trim(p_zip), ''), case when v_ssn is null then null else extensions.pgp_sym_encrypt(v_ssn, v_key) end, case when v_ssn is null then null else right(v_ssn, 4) end, coalesce(p_home_city, 'none'), auth.uid())
  on conflict (worker_id) do update set legal_first = excluded.legal_first, legal_middle = excluded.legal_middle, legal_last = excluded.legal_last,
      street = excluded.street, street2 = excluded.street2, city = excluded.city, state = excluded.state, zip = excluded.zip,
      ssn_enc = coalesce(excluded.ssn_enc, wp.ssn_enc), ssn_last4 = coalesce(excluded.ssn_last4, wp.ssn_last4), home_city = excluded.home_city, updated_by = auth.uid(), updated_at = now();
  update public.workers set home_city = coalesce(p_home_city, 'none') where id = p_worker;
end $$;
-- ===== Books: income, expenses, receipts; reminder completion =====
create table public.income (
  id uuid primary key default gen_random_uuid(),
  on_date date not null,
  site_id uuid references public.sites(id) on delete set null,
  client text not null default '',
  amount numeric not null check (amount >= 0),
  method text not null default 'check' check (method in ('check','cash','card','transfer','other')),
  reference text not null default '',
  note text not null default '',
  photo_path text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index income_date_idx on public.income (on_date);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  on_date date not null,
  category text not null,
  vendor text not null default '',
  amount numeric not null check (amount >= 0),
  miles numeric,
  site_id uuid references public.sites(id) on delete set null,
  note text not null default '',
  receipt_path text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (on_date);
create table public.done_items (
  key text primary key,
  done_on date not null default current_date,
  by_name text not null default ''
);
alter table public.income enable row level security;
alter table public.expenses enable row level security;
alter table public.done_items enable row level security;
create policy income_all on public.income for all to authenticated using (public.app_role() in ('owner','manager')) with check (public.app_role() in ('owner','manager'));
create policy expenses_all on public.expenses for all to authenticated using (public.app_role() in ('owner','manager')) with check (public.app_role() in ('owner','manager'));
create policy done_all on public.done_items for all to authenticated using (public.app_role() in ('owner','manager')) with check (public.app_role() in ('owner','manager'));
grant select, insert, update, delete on public.income, public.expenses, public.done_items to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 20971520, array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do nothing;
create policy books_rw on storage.objects for all to authenticated
  using (bucket_id = 'books' and public.app_role() in ('owner','manager')) with check (bucket_id = 'books' and public.app_role() in ('owner','manager'));
-- Names of active W-2 workers who have not signed their tax paperwork. Managers use it for reminders.
create function public.paperwork_missing() returns setof text language sql stable security definer set search_path = public as
$$ select w.name from public.workers w
   where not w.archived and w.terminated_on is null and w.type = 'W-2' and public.app_role() in ('owner','manager')
     and not exists (select 1 from public.worker_private p where p.worker_id = w.id and p.w4_signed_at is not null)
   order by w.name $$;
grant execute on function public.paperwork_missing() to authenticated;
-- Which year-quarters had W-2 payroll. Reminders use it so nothing is flagged for periods before the business ran payroll.
create function public.pay_quarters() returns setof text language sql stable security definer set search_path = public as
$$ select distinct year || '-Q' || (floor((extract(month from pay_date) - 1) / 3) + 1)::int from public.paychecks where type = 'W-2' and public.app_role() in ('owner','manager') order by 1 $$;
grant execute on function public.pay_quarters() to authenticated;
alter table public.expenses add column if not exists vehicle text not null default '';
-- Contractors do not accrue Michigan sick time and do not count toward the ESTA headcount.
create or replace function public.accrue_sick_for_punch(p_punch uuid) returns void language plpgsql security definer set search_path = public as
$$
declare v_p public.punches; v_h numeric; v_type text;
begin
  select * into v_p from public.punches where id = p_punch and status = 'approved' and clock_out is not null;
  if not found then return; end if;
  select type into v_type from public.workers where id = v_p.worker_id;
  if v_type <> 'W-2' then return; end if;
  v_h := greatest(0, extract(epoch from (v_p.clock_out - v_p.clock_in)) / 3600 - v_p.break_minutes / 60.0);
  insert into public.sick_ledger (worker_id, kind, hours, effective_on, punch_id, note, created_by)
  values (v_p.worker_id, 'accrual', round(v_h / 30.0, 3), v_p.clock_in::date, p_punch, 'Earned from a shift', null)
  on conflict (punch_id) where punch_id is not null do nothing;
end $$;

create or replace function public.rebuild_headcount() returns void
  language plpgsql security definer set search_path = public as
$$
declare v_from date; v_to date; v_prev_small boolean; v_small boolean; v_wk date;
begin
  select least(min(coalesce(hire_date, created_at::date)), (date_trunc('year', current_date) - interval '1 year')::date) into v_from from public.workers;
  if v_from is null then return; end if;
  v_from := public.app_week_start(v_from);
  v_to := greatest(public.app_week_start(current_date), v_from);
  delete from public.headcount_weeks where true;
  insert into public.headcount_weeks (week_start, headcount, fte)
  select w::date,
         (select count(*) from public.workers k
           where k.type = 'W-2' and coalesce(k.hire_date, k.created_at::date) <= w::date + 6
             and (k.terminated_on is null or k.terminated_on >= w::date)
             and not k.archived),
         (select coalesce(sum(least(h, 130)) / 120.0, 0) from (
            select sum(extract(epoch from (coalesce(p.clock_out, p.clock_in) - p.clock_in)) / 3600 - p.break_minutes / 60.0) h
            from public.punches p join public.workers k on k.id = p.worker_id where p.status <> 'rejected' and k.type = 'W-2'
              and p.clock_in >= date_trunc('month', w) and p.clock_in < date_trunc('month', w) + interval '1 month'
            group by p.worker_id) m)
  from generate_series(v_from::timestamp, v_to::timestamp, interval '7 days') w;
  v_prev_small := true;
  for v_wk in select week_start from public.headcount_weeks order by week_start loop
    v_small := public.app_is_small_on(v_wk);
    if v_prev_small and not v_small then
      insert into public.status_changes (kind, changed_on, detail)
      values ('small_business_lost', v_wk, 'Ten or more employees in 20 or more weeks. Sick time caps are now 72 hours.')
      on conflict do nothing;
    end if;
    v_prev_small := v_small;
  end loop;
end $$;
drop trigger if exists workers_headcount on public.workers;
create trigger workers_headcount after insert or update of hire_date, terminated_on, archived, type or delete on public.workers
  for each statement execute function public.workers_changed();
select public.rebuild_headcount();
alter table public.workers add column if not exists classification jsonb not null default '{}'::jsonb, add column if not exists w9_on_file boolean not null default false;
-- ===== Contractor invoices: 1099 workers bill per visit instead of clocking in =====
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  on_date date not null,
  hours numeric not null default 0 check (hours >= 0 and hours <= 24),
  rate numeric not null default 0 check (rate >= 0),
  agreed_rate numeric not null default 0,
  extras jsonb not null default '[]'::jsonb,          -- [{ "desc": "Floor stripper", "amount": 42.10 }]
  total numeric not null default 0,
  note text not null default '',
  photo_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
  decided_by uuid, decided_at timestamptz, decision_note text not null default '',
  paycheck_id uuid references public.paychecks(id) on delete set null,
  created_at timestamptz not null default now()
);
create index invoices_worker_idx on public.invoices (worker_id, on_date);
alter table public.invoices enable row level security;
create policy invoices_read on public.invoices for select to authenticated
  using (public.app_role() in ('owner','manager') or worker_id = public.app_worker_id());
grant select on public.invoices to authenticated;

-- Contractors upload invoice photos under proof/invoices/<their worker id>/...
create policy invoice_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'proof' and (storage.foldername(name))[1] = 'invoices' and (storage.foldername(name))[2] = public.app_worker_id()::text);
create policy invoice_view on storage.objects for select to authenticated
  using (bucket_id = 'proof' and (storage.foldername(name))[1] = 'invoices' and ((storage.foldername(name))[2] = public.app_worker_id()::text or public.app_role() in ('owner','manager')));

create function public.submit_invoice(p_site uuid, p_on date, p_hours numeric, p_rate numeric, p_extras jsonb, p_note text, p_photo text)
  returns public.invoices language plpgsql security definer set search_path = public as
$$
declare v_w public.workers; v_extra numeric := 0; v_row public.invoices; v_e jsonb;
begin
  select * into v_w from public.workers where id = public.app_worker_id();
  if not found then raise exception 'Your login is not linked to a worker yet.'; end if;
  if v_w.type <> '1099' then raise exception 'Only contractors submit invoices. Employees clock in.'; end if;
  if p_on is null or p_on > current_date then raise exception 'Enter the date of the visit.'; end if;
  if p_site is not null and not exists (select 1 from public.site_assignments where site_id = p_site and worker_id = v_w.id) then raise exception 'You are not assigned to that site.'; end if;
  for v_e in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) loop v_extra := v_extra + coalesce((v_e->>'amount')::numeric, 0); end loop;
  if coalesce(p_hours, 0) = 0 and v_extra = 0 then raise exception 'Enter hours on site or at least one line item.'; end if;
  insert into public.invoices (worker_id, site_id, on_date, hours, rate, agreed_rate, extras, total, note, photo_path)
  values (v_w.id, p_site, p_on, coalesce(p_hours, 0), coalesce(p_rate, v_w.rate), v_w.rate, coalesce(p_extras, '[]'::jsonb), round(coalesce(p_hours, 0) * coalesce(p_rate, v_w.rate) + v_extra, 2), coalesce(trim(p_note), ''), p_photo)
  returning * into v_row;
  return v_row;
end $$;

create function public.cancel_invoice(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$ begin delete from public.invoices where id = p_id and worker_id = public.app_worker_id() and status = 'pending'; if not found then raise exception 'Only your own pending invoices can be withdrawn.'; end if; end $$;

create function public.decide_invoice(p_id uuid, p_status text, p_note text) returns public.invoices language plpgsql security definer set search_path = public as
$$
declare v_row public.invoices;
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can approve invoices.'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Unknown decision.'; end if;
  if p_status = 'rejected' and coalesce(trim(p_note), '') = '' then raise exception 'Tell the contractor why.'; end if;
  update public.invoices set status = p_status, decided_by = auth.uid(), decided_at = now(), decision_note = coalesce(trim(p_note), '') where id = p_id and status = 'pending' returning * into v_row;
  if not found then raise exception 'That invoice was already decided.'; end if;
  return v_row;
end $$;

create function public.attach_invoices(p_paycheck uuid, p_ids uuid[]) returns int language plpgsql security definer set search_path = public as
$$
declare v_n int;
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can run payroll.'; end if;
  update public.invoices i set paycheck_id = p_paycheck, status = 'paid' where i.id = any(p_ids) and i.status = 'approved' and i.paycheck_id is null
    and i.worker_id = (select worker_id from public.paychecks where id = p_paycheck);
  get diagnostics v_n = row_count; return v_n;
end $$;
grant execute on function public.submit_invoice(uuid, date, numeric, numeric, jsonb, text, text), public.cancel_invoice(uuid), public.decide_invoice(uuid, text, text), public.attach_invoices(uuid, uuid[]) to authenticated;
-- ===== Proof of completion on contractor invoices =====
create table public.invoice_checks (
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  task_id uuid not null references public.site_tasks(id) on delete cascade,
  proof_path text,
  proof_type text check (proof_type is null or proof_type in ('photo','video')),
  primary key (invoice_id, task_id)
);
alter table public.invoice_checks enable row level security;
create policy invoice_checks_read on public.invoice_checks for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));
grant select on public.invoice_checks to authenticated;

-- Videos up to 60 MB are already allowed on the proof bucket; the invoices folder policies cover them.
drop function public.submit_invoice(uuid, date, numeric, numeric, jsonb, text, text);
create function public.submit_invoice(p_site uuid, p_on date, p_hours numeric, p_rate numeric, p_extras jsonb, p_note text, p_photo text, p_checks jsonb default '[]'::jsonb)
  returns public.invoices language plpgsql security definer set search_path = public as
$$
declare v_w public.workers; v_extra numeric := 0; v_row public.invoices; v_e jsonb; v_c jsonb; v_missing text;
begin
  select * into v_w from public.workers where id = public.app_worker_id();
  if not found then raise exception 'Your login is not linked to a worker yet.'; end if;
  if v_w.type <> '1099' then raise exception 'Only contractors submit invoices. Employees clock in.'; end if;
  if p_on is null or p_on > current_date then raise exception 'Enter the date of the visit.'; end if;
  if p_site is not null and not exists (select 1 from public.site_assignments where site_id = p_site and worker_id = v_w.id) then raise exception 'You are not assigned to that site.'; end if;
  for v_e in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) loop v_extra := v_extra + coalesce((v_e->>'amount')::numeric, 0); end loop;
  if coalesce(p_hours, 0) = 0 and v_extra = 0 then raise exception 'Enter hours on site or at least one line item.'; end if;
  -- every required-proof task at this site must be in the checks with a file
  if p_site is not null then
    select string_agg(t.title, ', ') into v_missing from public.site_tasks t where t.site_id = p_site and t.active and t.proof_required
      and not exists (select 1 from jsonb_array_elements(coalesce(p_checks, '[]'::jsonb)) c where (c->>'task_id')::uuid = t.id and coalesce(c->>'proof_path', '') <> '');
    if v_missing is not null then raise exception 'Proof is required for: %.', v_missing; end if;
  end if;
  insert into public.invoices (worker_id, site_id, on_date, hours, rate, agreed_rate, extras, total, note, photo_path)
  values (v_w.id, p_site, p_on, coalesce(p_hours, 0), coalesce(p_rate, v_w.rate), v_w.rate, coalesce(p_extras, '[]'::jsonb), round(coalesce(p_hours, 0) * coalesce(p_rate, v_w.rate) + v_extra, 2), coalesce(trim(p_note), ''), p_photo)
  returning * into v_row;
  for v_c in select * from jsonb_array_elements(coalesce(p_checks, '[]'::jsonb)) loop
    if exists (select 1 from public.site_tasks t where t.id = (v_c->>'task_id')::uuid and t.site_id = p_site and t.active) then
      insert into public.invoice_checks (invoice_id, task_id, proof_path, proof_type) values (v_row.id, (v_c->>'task_id')::uuid, nullif(v_c->>'proof_path', ''), nullif(v_c->>'proof_type', '')) on conflict do nothing;
    end if;
  end loop;
  return v_row;
end $$;
grant execute on function public.submit_invoice(uuid, date, numeric, numeric, jsonb, text, text, jsonb) to authenticated;
-- ===== Job board for contractors, and a hard line between contractors and employees =====
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  on_date date not null,
  due_by date,                                   -- null: that day; otherwise any time between on_date and due_by
  description text not null default '',
  kind text not null default 'flat' check (kind in ('flat','hourly')),
  price numeric not null default 0 check (price >= 0),   -- flat price, or hourly rate
  hours_est numeric,                                       -- for hourly jobs
  status text not null default 'open' check (status in ('open','claimed','done','cancelled')),
  claimed_by uuid references public.workers(id) on delete set null,
  claimed_at timestamptz,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index jobs_date_idx on public.jobs (on_date);
alter table public.jobs enable row level security;
-- Managers see everything. Contractors see open jobs and their own claimed ones.
create policy jobs_read on public.jobs for select to authenticated
  using (public.app_role() in ('owner','manager') or status = 'open' or claimed_by = public.app_worker_id());
grant select on public.jobs to authenticated;
alter table public.invoices add column job_id uuid references public.jobs(id) on delete set null;

create function public.post_job(p_site uuid, p_on date, p_due date, p_desc text, p_kind text, p_price numeric, p_hours numeric) returns public.jobs
  language plpgsql security definer set search_path = public as
$$
declare v_row public.jobs;
begin
  if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can post jobs.'; end if;
  if p_kind not in ('flat','hourly') then raise exception 'Choose flat price or hourly.'; end if;
  if coalesce(p_price, 0) <= 0 then raise exception 'Enter the price.'; end if;
  if p_due is not null and p_due < p_on then raise exception 'The due date is before the start date.'; end if;
  insert into public.jobs (site_id, on_date, due_by, description, kind, price, hours_est) values (p_site, p_on, p_due, coalesce(trim(p_desc), ''), p_kind, p_price, p_hours) returning * into v_row;
  return v_row;
end $$;

create function public.cancel_job(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$ begin if public.app_role() not in ('owner','manager') then raise exception 'Only a manager can cancel jobs.'; end if;
   update public.jobs set status = 'cancelled' where id = p_id and status in ('open','claimed'); if not found then raise exception 'That job cannot be cancelled now.'; end if; end $$;

-- A contractor takes an open job. Claiming assigns them to the site so its task list and invoice work.
create function public.claim_job(p_id uuid) returns public.jobs language plpgsql security definer set search_path = public as
$$
declare v_w public.workers; v_row public.jobs;
begin
  select * into v_w from public.workers where id = public.app_worker_id();
  if not found or v_w.type <> '1099' or v_w.archived then raise exception 'Only active contractors can claim jobs.'; end if;
  update public.jobs set status = 'claimed', claimed_by = v_w.id, claimed_at = now() where id = p_id and status = 'open' returning * into v_row;
  if not found then raise exception 'That job was already taken.'; end if;
  insert into public.site_assignments (site_id, worker_id) values (v_row.site_id, v_w.id) on conflict do nothing;
  return v_row;
end $$;

create function public.release_job(p_id uuid) returns void language plpgsql security definer set search_path = public as
$$ begin update public.jobs set status = 'open', claimed_by = null, claimed_at = null where id = p_id and status = 'claimed' and claimed_by = public.app_worker_id();
   if not found then raise exception 'Only a job you claimed and have not billed can be released.'; end if; end $$;

-- Invoice against a job: closes the job. Replaces the previous submit_invoice.
drop function public.submit_invoice(uuid, date, numeric, numeric, jsonb, text, text, jsonb);
create function public.submit_invoice(p_site uuid, p_on date, p_hours numeric, p_rate numeric, p_extras jsonb, p_note text, p_photo text, p_checks jsonb default '[]'::jsonb, p_job uuid default null)
  returns public.invoices language plpgsql security definer set search_path = public as
$$
declare v_w public.workers; v_extra numeric := 0; v_row public.invoices; v_e jsonb; v_c jsonb; v_missing text; v_j public.jobs;
begin
  select * into v_w from public.workers where id = public.app_worker_id();
  if not found then raise exception 'Your login is not linked to a worker yet.'; end if;
  if v_w.type <> '1099' then raise exception 'Only contractors submit invoices. Employees clock in.'; end if;
  if p_on is null or p_on > current_date then raise exception 'Enter the date of the visit.'; end if;
  if p_job is not null then select * into v_j from public.jobs where id = p_job and claimed_by = v_w.id and status = 'claimed'; if not found then raise exception 'That job is not yours to bill.'; end if; p_site := v_j.site_id; end if;
  if p_site is not null and not exists (select 1 from public.site_assignments where site_id = p_site and worker_id = v_w.id) then raise exception 'You are not assigned to that site.'; end if;
  for v_e in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) loop v_extra := v_extra + coalesce((v_e->>'amount')::numeric, 0); end loop;
  if coalesce(p_hours, 0) = 0 and v_extra = 0 then raise exception 'Enter hours on site or at least one line item.'; end if;
  if p_site is not null then
    select string_agg(t.title, ', ') into v_missing from public.site_tasks t where t.site_id = p_site and t.active and t.proof_required
      and not exists (select 1 from jsonb_array_elements(coalesce(p_checks, '[]'::jsonb)) c where (c->>'task_id')::uuid = t.id and coalesce(c->>'proof_path', '') <> '');
    if v_missing is not null then raise exception 'Proof is required for: %.', v_missing; end if;
  end if;
  insert into public.invoices (worker_id, site_id, on_date, hours, rate, agreed_rate, extras, total, note, photo_path, job_id)
  values (v_w.id, p_site, p_on, coalesce(p_hours, 0), coalesce(p_rate, v_w.rate), case when v_j.id is not null and v_j.kind = 'hourly' then v_j.price else v_w.rate end, coalesce(p_extras, '[]'::jsonb),
          round(coalesce(p_hours, 0) * coalesce(p_rate, v_w.rate) + v_extra, 2), coalesce(trim(p_note), ''), p_photo, p_job)
  returning * into v_row;
  for v_c in select * from jsonb_array_elements(coalesce(p_checks, '[]'::jsonb)) loop
    if exists (select 1 from public.site_tasks t where t.id = (v_c->>'task_id')::uuid and t.site_id = p_site and t.active) then
      insert into public.invoice_checks (invoice_id, task_id, proof_path, proof_type) values (v_row.id, (v_c->>'task_id')::uuid, nullif(v_c->>'proof_path', ''), nullif(v_c->>'proof_type', '')) on conflict do nothing;
    end if;
  end loop;
  if v_j.id is not null then update public.jobs set status = 'done', invoice_id = v_row.id where id = v_j.id; end if;
  return v_row;
end $$;
grant execute on function public.post_job(uuid, date, date, text, text, numeric, numeric), public.cancel_job(uuid), public.claim_job(uuid), public.release_job(uuid),
  public.submit_invoice(uuid, date, numeric, numeric, jsonb, text, text, jsonb, uuid) to authenticated;

-- Contractors are never scheduled and never clock in.
create or replace function public.schedule_guard() returns trigger language plpgsql as
$$ begin if (select type from public.workers where id = new.worker_id) <> 'W-2' then raise exception 'Contractors are not scheduled. Post the work on the job board instead.'; end if; return new; end $$;
create trigger shifts_w2_only before insert on public.shifts for each row execute function public.schedule_guard();
create or replace function public.punch_guard() returns trigger language plpgsql as
$$ begin if (select type from public.workers where id = new.worker_id) <> 'W-2' then raise exception 'Contractors do not clock in. They bill their visits under Invoices.'; end if; return new; end $$;
create trigger punches_w2_only before insert on public.punches for each row execute function public.punch_guard();
-- Flat-price job invoices carry no hourly rate, so the agreed rate is recorded as the rate used and never flagged as a difference.
create or replace function public.submit_invoice(p_site uuid, p_on date, p_hours numeric, p_rate numeric, p_extras jsonb, p_note text, p_photo text, p_checks jsonb default '[]'::jsonb, p_job uuid default null)
  returns public.invoices language plpgsql security definer set search_path = public as
$$
declare v_w public.workers; v_extra numeric := 0; v_row public.invoices; v_e jsonb; v_c jsonb; v_missing text; v_j public.jobs;
begin
  select * into v_w from public.workers where id = public.app_worker_id();
  if not found then raise exception 'Your login is not linked to a worker yet.'; end if;
  if v_w.type <> '1099' then raise exception 'Only contractors submit invoices. Employees clock in.'; end if;
  if p_on is null or p_on > current_date then raise exception 'Enter the date of the visit.'; end if;
  if p_job is not null then select * into v_j from public.jobs where id = p_job and claimed_by = v_w.id and status = 'claimed'; if not found then raise exception 'That job is not yours to bill.'; end if; p_site := v_j.site_id; end if;
  if p_site is not null and not exists (select 1 from public.site_assignments where site_id = p_site and worker_id = v_w.id) then raise exception 'You are not assigned to that site.'; end if;
  for v_e in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) loop v_extra := v_extra + coalesce((v_e->>'amount')::numeric, 0); end loop;
  if coalesce(p_hours, 0) = 0 and v_extra = 0 then raise exception 'Enter hours on site or at least one line item.'; end if;
  if p_site is not null then
    select string_agg(t.title, ', ') into v_missing from public.site_tasks t where t.site_id = p_site and t.active and t.proof_required
      and not exists (select 1 from jsonb_array_elements(coalesce(p_checks, '[]'::jsonb)) c where (c->>'task_id')::uuid = t.id and coalesce(c->>'proof_path', '') <> '');
    if v_missing is not null then raise exception 'Proof is required for: %.', v_missing; end if;
  end if;
  insert into public.invoices (worker_id, site_id, on_date, hours, rate, agreed_rate, extras, total, note, photo_path, job_id)
  values (v_w.id, p_site, p_on, coalesce(p_hours, 0), coalesce(p_rate, v_w.rate),
          case when v_j.id is not null then (case when v_j.kind = 'hourly' then v_j.price else coalesce(p_rate, 0) end) else v_w.rate end,
          coalesce(p_extras, '[]'::jsonb), round(coalesce(p_hours, 0) * coalesce(p_rate, v_w.rate) + v_extra, 2), coalesce(trim(p_note), ''), p_photo, p_job)
  returning * into v_row;
  for v_c in select * from jsonb_array_elements(coalesce(p_checks, '[]'::jsonb)) loop
    if exists (select 1 from public.site_tasks t where t.id = (v_c->>'task_id')::uuid and t.site_id = p_site and t.active) then
      insert into public.invoice_checks (invoice_id, task_id, proof_path, proof_type) values (v_row.id, (v_c->>'task_id')::uuid, nullif(v_c->>'proof_path', ''), nullif(v_c->>'proof_type', '')) on conflict do nothing;
    end if;
  end loop;
  if v_j.id is not null then update public.jobs set status = 'done', invoice_id = v_row.id where id = v_j.id; end if;
  return v_row;
end $$;
-- ===== Paperwork at sign-up, before the login is approved or linked =====
create table public.pending_paperwork (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  legal_first text not null default '', legal_middle text not null default '', legal_last text not null default '',
  street text not null default '', street2 text not null default '', city text not null default '', state text not null default 'MI', zip text not null default '',
  ssn_enc bytea, ssn_last4 text, home_city text not null default 'none',
  filing text not null default 'Single', step2 boolean not null default false, dependents numeric not null default 0, extra numeric not null default 0,
  other_income numeric not null default 0, deductions numeric not null default 0, mi_exemptions numeric not null default 1,
  signed_at timestamptz, signed_name text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.pending_paperwork enable row level security;
revoke all on public.pending_paperwork from authenticated, anon;

-- Works for any signed-in login, approved or not. Uses auth.uid() directly because app_role() is null until approval.
create function public.submit_pending_paperwork(p_first text, p_middle text, p_last text, p_street text, p_street2 text, p_city text, p_state text, p_zip text,
    p_ssn text, p_home_city text, p_filing text, p_step2 boolean, p_dependents numeric, p_extra numeric, p_other_income numeric, p_deductions numeric, p_mi_exemptions numeric, p_sign_name text)
  returns void language plpgsql security definer set search_path = public as
$$
declare v_ssn text := public.app_valid_ssn(p_ssn); v_key text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if coalesce(trim(p_first), '') = '' or coalesce(trim(p_last), '') = '' then raise exception 'Enter your legal first and last name.'; end if;
  if coalesce(trim(p_street), '') = '' or coalesce(trim(p_city), '') = '' or coalesce(trim(p_zip), '') = '' then raise exception 'Enter your home address.'; end if;
  if p_filing not in ('Single','MFJ','HOH') then raise exception 'Choose a filing status.'; end if;
  if coalesce(trim(p_sign_name), '') = '' then raise exception 'Type your name to sign.'; end if;
  v_key := public.app_pii_key();
  insert into public.pending_paperwork as pp (profile_id, legal_first, legal_middle, legal_last, street, street2, city, state, zip, ssn_enc, ssn_last4, home_city, filing, step2, dependents, extra, other_income, deductions, mi_exemptions, signed_at, signed_name)
  values (auth.uid(), trim(p_first), coalesce(trim(p_middle), ''), trim(p_last), trim(p_street), coalesce(trim(p_street2), ''), trim(p_city), upper(coalesce(p_state, 'MI')), trim(p_zip),
      case when v_ssn is null then null else extensions.pgp_sym_encrypt(v_ssn, v_key) end, case when v_ssn is null then null else right(v_ssn, 4) end, coalesce(p_home_city, 'none'),
      p_filing, coalesce(p_step2, false), coalesce(p_dependents, 0), coalesce(p_extra, 0), coalesce(p_other_income, 0), coalesce(p_deductions, 0), coalesce(p_mi_exemptions, 0), now(), trim(p_sign_name))
  on conflict (profile_id) do update set legal_first = excluded.legal_first, legal_middle = excluded.legal_middle, legal_last = excluded.legal_last, street = excluded.street, street2 = excluded.street2,
      city = excluded.city, state = excluded.state, zip = excluded.zip, ssn_enc = coalesce(excluded.ssn_enc, pp.ssn_enc), ssn_last4 = coalesce(excluded.ssn_last4, pp.ssn_last4), home_city = excluded.home_city,
      filing = excluded.filing, step2 = excluded.step2, dependents = excluded.dependents, extra = excluded.extra, other_income = excluded.other_income, deductions = excluded.deductions, mi_exemptions = excluded.mi_exemptions,
      signed_at = now(), signed_name = excluded.signed_name, updated_at = now();
  -- if this login is already linked to a worker, apply it straight away
  perform public.apply_pending_paperwork(auth.uid());
end $$;

-- Copies a signed pending record onto the linked worker, then removes it. Safe to call any time.
create function public.apply_pending_paperwork(p_profile uuid) returns void language plpgsql security definer set search_path = public as
$$
declare v_pp public.pending_paperwork; v_w uuid;
begin
  select worker_id into v_w from public.profiles where id = p_profile; if v_w is null then return; end if;
  select * into v_pp from public.pending_paperwork where profile_id = p_profile and signed_at is not null; if not found then return; end if;
  insert into public.worker_private as wp (worker_id, legal_first, legal_middle, legal_last, street, street2, city, state, zip, ssn_enc, ssn_last4, home_city, w4_signed_at, w4_signed_name, w4_year, updated_by)
  values (v_w, v_pp.legal_first, v_pp.legal_middle, v_pp.legal_last, v_pp.street, v_pp.street2, v_pp.city, v_pp.state, v_pp.zip, v_pp.ssn_enc, v_pp.ssn_last4, v_pp.home_city, v_pp.signed_at, v_pp.signed_name, extract(year from v_pp.signed_at)::int, p_profile)
  on conflict (worker_id) do update set legal_first = excluded.legal_first, legal_middle = excluded.legal_middle, legal_last = excluded.legal_last, street = excluded.street, street2 = excluded.street2, city = excluded.city, state = excluded.state, zip = excluded.zip,
      ssn_enc = coalesce(excluded.ssn_enc, wp.ssn_enc), ssn_last4 = coalesce(excluded.ssn_last4, wp.ssn_last4), home_city = excluded.home_city, w4_signed_at = excluded.w4_signed_at, w4_signed_name = excluded.w4_signed_name, w4_year = excluded.w4_year, updated_at = now();
  update public.workers set filing = v_pp.filing, step2 = v_pp.step2, dependents_credit = v_pp.dependents, extra_withholding = v_pp.extra, other_income = v_pp.other_income, deductions = v_pp.deductions, mi_exemptions = v_pp.mi_exemptions, home_city = v_pp.home_city where id = v_w;
  delete from public.pending_paperwork where profile_id = p_profile;
end $$;

-- What a pending login has entered so far (never the SSN).
create function public.my_pending_paperwork() returns jsonb language sql stable security definer set search_path = public as
$$ select coalesce((select jsonb_build_object('legal_first', legal_first, 'legal_middle', legal_middle, 'legal_last', legal_last, 'street', street, 'street2', street2, 'city', city, 'state', state, 'zip', zip,
     'ssn_last4', ssn_last4, 'has_ssn', ssn_enc is not null, 'home_city', home_city, 'filing', filing, 'step2', step2, 'dependents', dependents, 'extra', extra, 'other_income', other_income, 'deductions', deductions,
     'mi_exemptions', mi_exemptions, 'w4_signed_at', signed_at, 'w4_signed_name', signed_name) from public.pending_paperwork where profile_id = auth.uid()), '{}'::jsonb) $$;

-- Managers see who has paperwork waiting, to prefill the worker record when they link it.
create function public.pending_paperwork_names() returns table (profile_id uuid, legal_name text, city text) language sql stable security definer set search_path = public as
$$ select profile_id, trim(legal_first || ' ' || legal_last), city from public.pending_paperwork where signed_at is not null and public.app_role() in ('owner','manager') $$;

grant execute on function public.submit_pending_paperwork(text, text, text, text, text, text, text, text, text, text, text, boolean, numeric, numeric, numeric, numeric, numeric, text),
  public.apply_pending_paperwork(uuid), public.my_pending_paperwork(), public.pending_paperwork_names() to authenticated;

-- Linking a worker record applies any waiting paperwork.
create or replace function public.set_profile(p_id uuid, p_role text, p_active boolean, p_worker uuid)
  returns public.profiles language plpgsql security definer set search_path = public as
$$
declare v_me text := public.app_role(); v_admin boolean := public.app_is_admin(); v_t public.profiles; v_row public.profiles;
begin
  if v_me is null or v_me not in ('owner','manager') then raise exception 'Only an owner or manager can manage people.'; end if;
  if p_role not in ('owner','manager','supervisor','employee') then raise exception 'Unknown role.'; end if;
  select * into v_t from public.profiles where id = p_id;
  if not found then raise exception 'Person not found.'; end if;
  if v_t.is_admin and not v_admin then raise exception 'Only an administrator can change an administrator.'; end if;
  if v_me = 'manager' and (v_t.role in ('owner','manager') or p_role in ('owner','manager')) then
    raise exception 'Only an owner can change owners and managers.'; end if;
  if v_t.role = 'owner' and v_t.active and (p_role <> 'owner' or not p_active)
     and (select count(*) from public.profiles where (role = 'owner' or is_admin) and active) <= 1 then
    raise exception 'There must be at least one active owner or administrator.'; end if;
  if p_worker is not null and exists (select 1 from public.profiles where worker_id = p_worker and id <> p_id) then
    raise exception 'That worker is already linked to another login.'; end if;
  update public.profiles set role = p_role, active = p_active, worker_id = p_worker where id = p_id returning * into v_row;
  if p_worker is not null then perform public.apply_pending_paperwork(p_id); end if;
  return v_row;
end $$;
-- ===== Hours added or corrected by a manager attach to the scheduled shift =====
-- Before: only the worker's own clock-in matched a scheduled shift. Hours a manager entered for a day the worker
-- forgot to clock in left the shift "missed" on the schedule and the guarantee never applied.
create or replace function public.add_punch(p_worker uuid, p_site uuid, p_in timestamptz, p_out timestamptz, p_break int, p_reason text)
  returns public.punches language plpgsql security definer set search_path = public as
$$
declare v_row public.punches; v_name text; v_shift public.shifts;
begin
  if not public.app_can_manage_punch(p_worker, p_site) then raise exception 'You do not have access to add hours here.'; end if;
  if p_out is null or p_out <= p_in then raise exception 'Clock-out must be after clock-in.'; end if;
  if p_out - p_in > interval '24 hours' then raise exception 'A shift cannot be longer than 24 hours.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Enter a reason for adding these hours.'; end if;
  v_shift := public.app_match_shift(p_worker, p_site, p_in);
  insert into public.punches (worker_id, site_id, clock_in, clock_out, break_minutes, status, manual, shift_id)
  values (p_worker, p_site, p_in, p_out, coalesce(p_break, 0), 'approved', true, v_shift.id) returning * into v_row;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.punch_edits (punch_id, edited_by, edited_by_name, reason, before, after)
  values (v_row.id, auth.uid(), coalesce(v_name, ''), p_reason, null,
    jsonb_build_object('clock_in', v_row.clock_in, 'clock_out', v_row.clock_out, 'break_minutes', v_row.break_minutes, 'status', v_row.status));
  return v_row;
end $$;

-- A corrected clock-in time that now falls inside a scheduled shift picks that shift up too.
create or replace function public.edit_punch(p_id uuid, p_in timestamptz, p_out timestamptz, p_break int, p_status text, p_reason text)
  returns public.punches language plpgsql security definer set search_path = public as
$$
declare v_p public.punches; v_row public.punches; v_changed boolean; v_name text; v_shift public.shifts;
begin
  select * into v_p from public.punches where id = p_id;
  if not found then raise exception 'Shift not found.'; end if;
  if not public.app_can_manage_punch(v_p.worker_id, v_p.site_id) then raise exception 'You do not have access to this shift.'; end if;
  if v_p.paycheck_id is not null then raise exception 'This shift is already on a paycheck. Delete that paycheck first.'; end if;
  if p_status not in ('submitted','approved','rejected') then raise exception 'Unknown status.'; end if;
  if p_out is null then raise exception 'Enter a clock-out time.'; end if;
  if p_out <= p_in then raise exception 'Clock-out must be after clock-in.'; end if;
  if p_out - p_in > interval '24 hours' then raise exception 'A shift cannot be longer than 24 hours.'; end if;
  v_changed := p_in is distinct from v_p.clock_in or p_out is distinct from v_p.clock_out or coalesce(p_break, 0) <> v_p.break_minutes;
  if (v_changed or p_status = 'rejected') and coalesce(trim(p_reason), '') = '' then
    raise exception 'Enter a reason for this change.'; end if;
  if v_p.shift_id is null then v_shift := public.app_match_shift(v_p.worker_id, v_p.site_id, p_in); end if;
  update public.punches set clock_in = p_in, clock_out = p_out, break_minutes = coalesce(p_break, 0), status = p_status, shift_id = coalesce(shift_id, v_shift.id)
   where id = p_id returning * into v_row;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.punch_edits (punch_id, edited_by, edited_by_name, reason, before, after)
  values (p_id, auth.uid(), coalesce(v_name, ''), coalesce(p_reason, ''),
    jsonb_build_object('clock_in', v_p.clock_in, 'clock_out', v_p.clock_out, 'break_minutes', v_p.break_minutes, 'status', v_p.status),
    jsonb_build_object('clock_in', v_row.clock_in, 'clock_out', v_row.clock_out, 'break_minutes', v_row.break_minutes, 'status', v_row.status));
  return v_row;
end $$;
-- ===== The owner's own tax settings, private to owners and administrators =====
-- Kept out of the shared settings row so managers, supervisors and workers never receive it.
create table public.owner_tax (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.owner_tax enable row level security;
create policy owner_tax_read on public.owner_tax for select to authenticated using (public.app_role() = 'owner');
create policy owner_tax_write on public.owner_tax for all to authenticated using (public.app_role() = 'owner') with check (public.app_role() = 'owner');
grant select, insert, update on public.owner_tax to authenticated;
insert into public.owner_tax (id, data) values (1, '{}'::jsonb);
