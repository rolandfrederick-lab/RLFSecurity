-- =====================================================================
-- Inbox: website contact form requests and the replies sent from the app.
-- The website's server (Cloudflare Worker) saves each request using the
-- public key, so anyone may add a request but nobody outside the business
-- can read one. Owners and managers read, update and reply.
-- =====================================================================

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  phone text not null default '' check (char_length(phone) <= 40),
  organization text not null default '' check (char_length(organization) <= 160),
  need text not null default '' check (char_length(need) <= 120),
  message text not null check (char_length(message) between 1 and 5000),
  status text not null default 'new' check (status in ('new', 'replied', 'archived')),
  read_at timestamptz
);
create index messages_created_idx on public.messages (created_at desc);

create table public.message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_by uuid references auth.users(id) default auth.uid(),
  sender_name text not null default '',
  subject text not null,
  body text not null check (char_length(body) between 1 and 20000)
);
create index message_replies_message_idx on public.message_replies (message_id, created_at);

alter table public.messages enable row level security;
alter table public.message_replies enable row level security;

-- New requests only: the form can't mark anything read, replied or archived.
create policy messages_submit on public.messages for insert to anon, authenticated
  with check (status = 'new' and read_at is null);
create policy messages_staff_read on public.messages for select to authenticated
  using (public.app_role() in ('owner', 'manager'));
create policy messages_staff_update on public.messages for update to authenticated
  using (public.app_role() in ('owner', 'manager')) with check (public.app_role() in ('owner', 'manager'));
create policy messages_staff_delete on public.messages for delete to authenticated
  using (public.app_role() in ('owner', 'manager'));

create policy replies_staff_read on public.message_replies for select to authenticated
  using (public.app_role() in ('owner', 'manager'));
create policy replies_staff_insert on public.message_replies for insert to authenticated
  with check (public.app_role() in ('owner', 'manager') and sent_by = auth.uid());

grant insert on public.messages to anon, authenticated;
grant select, update, delete on public.messages to authenticated;
grant select, insert on public.message_replies to authenticated;
