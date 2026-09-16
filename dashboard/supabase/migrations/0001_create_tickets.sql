-- Support tickets ingested by the n8n webhook → LLM classification workflow.
create table tickets (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  customer_email text,
  category text,
  urgency text,
  suggested_reply text,
  status text default 'pending_review',
  created_at timestamptz default now()
);

alter table tickets enable row level security;

create policy "Allow authenticated read/write"
on tickets for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- Required so the dashboard receives INSERT/UPDATE events without a refresh.
alter publication supabase_realtime add table tickets;
