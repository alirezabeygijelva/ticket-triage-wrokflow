# Ticket Manager

End-to-end multi-channel triage: customers message via website, email, or Telegram; an **n8n** workflow classifies intent (FAQ question, staff-needed question, or booking), stores results in **Supabase**, and a **Next.js** dashboard lets staff answer pending questions and review bookings.

## Architecture

```
Website /submit  ─┐
Gmail            ─┼─► n8n normalize → Gemini + FAQ tool
Telegram         ─┘         │
                            ▼
                     Find/create ticket thread + messages (+ bookings)
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     FAQ auto-reply   Staff notify    Google Calendar
     (auto_resolved)  (pending_staff)  confirm / suggest 2
                            │
                            ▼
              Dashboard Send & Resolve → /staff-reply
```

| Piece | Role |
| --- | --- |
| [`dashboard/`](./dashboard/) | Next.js UI — public submit form, auth-gated inbox, staff reply |
| [`n8n-workflow/`](./n8n-workflow/) | FAQ seed + Ticket Manager (intake, RAG, Calendar, outbound) |
| Supabase | Postgres `tickets` + `ticket_messages` + `bookings` + `faq` (pgvector), Auth, Realtime |

## Quick start

1. **Supabase** — create a project, apply migrations `0001`–`0005` under `dashboard/supabase/migrations/`, and create an email/password user for the dashboard.
2. **n8n** — import both workflows from `n8n-workflow/`, attach credentials (including Google Calendar), run **FAQ embeddings** once, activate **Ticket Manager**, and copy production webhook URLs.
3. **Dashboard** — from `dashboard/`, copy `.env.local.example` → `.env.local`, set Supabase keys plus:
   - `NEXT_PUBLIC_N8N_WEBHOOK_URL` → `/new-ticket`
   - `NEXT_PUBLIC_N8N_STAFF_REPLY_WEBHOOK_URL` → `/staff-reply`
   then `npm install && npm run dev`.

n8n exports use placeholder credential IDs (`REPLACE_ME_*`) — reconnect real credentials after import.

See package READMEs for detail:

- [Dashboard README](./dashboard/README.md)
- [n8n workflow README](./n8n-workflow/README.md)

## Message types

| Type | Behavior |
| --- | --- |
| Question in knowledge base | Auto-reply from FAQ; ticket `auto_resolved` and closed |
| Question not in knowledge base | Notify user that staff will answer; ticket `pending_staff`; staff uses **Send & Resolve** |
| Booking request | Check Google Calendar (30‑min slots, Mon–Fri 09:00–17:00 Asia/Istanbul); reserve if free, else suggest 2 times |

## Repository layout

```
.
├── README.md
├── dashboard/                 ← Next.js ticket manager
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── supabase/migrations/   ← tickets, FAQ, intent/booking, messages
└── n8n-workflow/
    ├── FAQ embeddings.json
    └── ticket-triage-workflow.json
```
