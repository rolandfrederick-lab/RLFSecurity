-- =====================================================================
-- Website content managed from the staff app (More, Website).
-- One row holds the editable text and photo paths for rlfsecurity.com;
-- photos live in the public "website" storage bucket.
-- Anyone can read (the public website needs to); only owners and
-- administrators (app_role() = 'owner') can change anything.
-- =====================================================================

create table public.website (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.website (id) values (1) on conflict (id) do nothing;

alter table public.website enable row level security;
create policy website_read on public.website for select to anon, authenticated using (true);
create policy website_write on public.website for update to authenticated
  using (public.app_role() = 'owner') with check (public.app_role() = 'owner');
grant select on public.website to anon, authenticated;
grant update on public.website to authenticated;

create function public.website_stamp() returns trigger language plpgsql set search_path = public as
$$ begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
create trigger website_stamp before update on public.website for each row execute function public.website_stamp();

-- Photos: public to view, owners upload, replace and delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('website', 'website', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy website_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'website' and public.app_role() = 'owner');
create policy website_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'website' and public.app_role() = 'owner');
create policy website_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'website' and public.app_role() = 'owner') with check (bucket_id = 'website' and public.app_role() = 'owner');
create policy website_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'website' and public.app_role() = 'owner');
