-- Intent / FAQ / booking fields for multi-channel triage.
alter table tickets add column if not exists channel text;
alter table tickets add column if not exists intent text;
alter table tickets add column if not exists answer_source text;
alter table tickets add column if not exists extracted_datetime timestamptz;
alter table tickets add column if not exists staff_reply text;
alter table tickets add column if not exists contact_id text;

-- Status values in use:
-- auto_resolved | pending_staff | resolved | booking_pending | booking_confirmed | spam
-- Legacy pending_review may still exist on older rows.

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets (id) on delete set null,
  requested_start timestamptz,
  confirmed_start timestamptz,
  duration_minutes int not null default 30,
  status text not null default 'requested',
  calendar_event_id text,
  suggested_slots jsonb,
  created_at timestamptz not null default now()
);

alter table bookings enable row level security;

create policy "Allow authenticated read/write bookings"
on bookings for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table bookings;
