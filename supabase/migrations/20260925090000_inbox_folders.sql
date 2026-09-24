-- =====================================================================
-- Inbox folders: Trash for requests and sent emails, and new emails
-- composed in the app (not tied to a website request).
-- =====================================================================

-- Requests can be moved to Trash (and restored) from the app.
alter table public.messages drop constraint messages_status_check;
alter table public.messages add constraint messages_status_check check (status in ('new', 'replied', 'archived', 'trash'));

-- Sent emails: replies keep their request; composed emails have none.
alter table public.message_replies alter column message_id drop not null;
alter table public.message_replies add column to_email text not null default '';
alter table public.message_replies add column to_name text not null default '';
alter table public.message_replies add column status text not null default 'sent' check (status in ('sent', 'trash'));
-- Deleting a request for good keeps the emails already sent about it in Sent.
alter table public.message_replies drop constraint message_replies_message_id_fkey;
alter table public.message_replies add constraint message_replies_message_id_fkey
  foreign key (message_id) references public.messages(id) on delete set null;
update public.message_replies r set to_email = m.email, to_name = m.name from public.messages m where r.message_id = m.id;

-- Staff can move sent emails to Trash and delete them for good.
create policy replies_staff_update on public.message_replies for update to authenticated
  using (public.app_role() in ('owner', 'manager')) with check (public.app_role() in ('owner', 'manager'));
create policy replies_staff_delete on public.message_replies for delete to authenticated
  using (public.app_role() in ('owner', 'manager'));
grant update, delete on public.message_replies to authenticated;
