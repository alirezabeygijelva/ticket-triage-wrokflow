-- Close flag: n8n only appends to open tickets.
-- Confirmed bookings and FAQ auto-replies are auto-closed.
alter table tickets add column if not exists closed boolean not null default false;

update tickets
set closed = true
where status in ('booking_confirmed', 'auto_resolved');
