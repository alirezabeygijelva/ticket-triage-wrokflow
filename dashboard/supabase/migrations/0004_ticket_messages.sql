-- Conversation messages for one ticket/thread per customer per channel.
alter table tickets add column if not exists updated_at timestamptz;

update tickets
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table tickets alter column updated_at set default now();
alter table tickets alter column updated_at set not null;

create table if not exists ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets (id) on delete cascade,
  role text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint ticket_messages_role_check check (role in ('customer', 'bot', 'staff'))
);

create index if not exists ticket_messages_ticket_id_created_at_idx
  on ticket_messages (ticket_id, created_at);

alter table ticket_messages enable row level security;

create policy "Allow authenticated read/write ticket_messages"
on ticket_messages for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table ticket_messages;
