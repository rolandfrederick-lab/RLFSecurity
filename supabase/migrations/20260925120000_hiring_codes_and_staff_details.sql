-- =====================================================================
-- Hiring codes and staff contact / guard license details.
--
-- Hiring codes: an account can only be created with a valid, unused,
-- unexpired code made by an owner or manager (People and roles). The
-- check runs in the database when the account is created, so it cannot
-- be skipped by going around the app. The very first account (the owner)
-- needs no code.
--
-- Staff details: phone, emergency contact and guard license, entered by
-- each person with their paperwork; owners and managers can read them.
-- =====================================================================

create table public.hire_codes (
  code text primary key check (code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  note text not null default '' check (char_length(note) <= 120),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked boolean not null default false,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null
);
alter table public.hire_codes enable row level security;
create policy hire_codes_staff on public.hire_codes for all to authenticated
  using (public.app_role() in ('owner', 'manager')) with check (public.app_role() in ('owner', 'manager'));
grant select, insert, update, delete on public.hire_codes to authenticated;

-- Which code each login signed up with (shown on People and roles).
alter table public.profiles add column hire_code text;

-- Codes are compared without dashes or spaces, in capitals.
create function public.normalize_hire_code(p text) returns text language sql immutable as
$$ select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) $$;

-- Lets the sign-up screen say whether a code is good before creating the account.
-- 'open' means no account exists yet, so the first sign-up (the owner) needs no code.
create function public.check_hire_code(p_code text) returns text
  language sql stable security definer set search_path = public as
$$
  select case
    when not exists (select 1 from public.profiles) then 'open'
    when h.code is null then 'invalid'
    when h.revoked then 'invalid'
    when h.used_at is not null then 'used'
    when h.expires_at <= now() then 'expired'
    else 'ok' end
  from (select 1) one left join public.hire_codes h on h.code = public.normalize_hire_code(p_code)
$$;
grant execute on function public.check_hire_code(text) to anon, authenticated;

-- Account creation: first account becomes the owner; everyone else must bring a good code,
-- which is used up by that sign-up.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare v_first boolean; v_code text; v_used text;
begin
  select not exists (select 1 from public.profiles) into v_first;
  if not v_first then
    v_code := public.normalize_hire_code(new.raw_user_meta_data->>'hire_code');
    update public.hire_codes set used_at = now(), used_by = new.id
      where code = v_code and used_at is null and not revoked and expires_at > now()
      returning code into v_used;
    if v_used is null then
      raise exception 'A valid hiring code is required to create an account.' using errcode = 'P0001';
    end if;
  end if;
  insert into public.profiles (id, email, full_name, role, active, hire_code)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''),
          case when v_first then 'owner' else 'employee' end, v_first, v_used);
  return new;
end $$;

create table public.staff_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone text not null default '' check (char_length(phone) <= 40),
  emergency_name text not null default '' check (char_length(emergency_name) <= 120),
  emergency_phone text not null default '' check (char_length(emergency_phone) <= 40),
  emergency_relation text not null default '' check (char_length(emergency_relation) <= 60),
  license_number text not null default '' check (char_length(license_number) <= 60),
  license_expires date,
  updated_at timestamptz not null default now()
);
alter table public.staff_details enable row level security;
create policy staff_details_own on public.staff_details for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy staff_details_staff_read on public.staff_details for select to authenticated
  using (public.app_role() in ('owner', 'manager'));
create policy staff_details_staff_insert on public.staff_details for insert to authenticated
  with check (public.app_role() in ('owner', 'manager'));
create policy staff_details_staff_update on public.staff_details for update to authenticated
  using (public.app_role() in ('owner', 'manager')) with check (public.app_role() in ('owner', 'manager'));
grant select, insert, update on public.staff_details to authenticated;

-- New-hire checklist for W-2 employees: Form I-9 (within 3 business days of the hire date)
-- and the Michigan new hire report (within 20 days). Workers already on payroll are left off
-- the checklist; everyone added from now on is on it.
alter table public.workers add column hire_checklist boolean not null default false;
alter table public.workers alter column hire_checklist set default true;
alter table public.workers add column i9_done_on date;
alter table public.workers add column newhire_reported_on date;
