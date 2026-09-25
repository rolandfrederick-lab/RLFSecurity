-- =====================================================================
-- Michigan Private Security Business and Security Alarm Act (1968 PA 330).
--
-- Security officers in Michigan are not licensed one by one: they work
-- under the agency's license, which is held by the owner and backed by the
-- required surety bond or insurance. The agency must fingerprint every
-- employee who provides security services (state and FBI check), keep a
-- signed employment application for at least 1 year, keep personnel
-- records, and file a quarterly employee roster (name, date of birth, hire
-- and termination dates) with LARA.
--
-- The license, bond and insurance details live in settings (data.agency).
-- =====================================================================

-- Screening steps on each worker record (shown on the new-hire checklist).
alter table public.workers add column fingerprint_on date;
alter table public.workers add column application_on date;
alter table public.workers add column eligibility_on date;

-- Date of birth is on the quarterly LARA roster. The license columns on
-- staff_details now hold a Michigan CPL for officers on armed posts.
alter table public.staff_details add column date_of_birth date;
comment on column public.staff_details.license_number is 'Michigan CPL number, armed officers only';
comment on column public.staff_details.license_expires is 'Michigan CPL expiration, armed officers only';
