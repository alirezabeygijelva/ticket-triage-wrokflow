# Ticket Manager (Dashboard)

Next.js inbox for reviewing multi-channel tickets produced by the [n8n Ticket Manager](../n8n-workflow/) workflow: FAQ auto-answers, staff-needed questions, and booking outcomes.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- `@supabase/supabase-js` + `@supabase/ssr` (cookie-based auth, browser client for realtime)

## How it connects to n8n

1. A customer submits on `/submit` (or Gmail / Telegram triggers n8n).
2. n8n classifies `intent` (`question` | `booking` | `spam`) and `answer_source` (`faq` | `staff_needed` | `not_applicable`).
3. n8n finds or creates **one open ticket per customer per channel**, appends the turn to `ticket_messages`, and writes `bookings` when relevant. Closed tickets are not reused; the next message starts a new ticket.
4. This dashboard listens to Realtime on `tickets` (inbox) and `ticket_messages` (conversation).
5. For `pending_staff` tickets, agents write a reply and click **Send & Resolve**, which POSTs to the n8n `/staff-reply` webhook with the staff member’s Supabase `Authorization: Bearer` access token so n8n can verify the session and deliver the answer on the original channel.

Webhook body for new tickets:

```json
{
  "ticket_message": "What are your opening hours?",
  "customer_email": "customer@example.com"
}
```

Staff reply webhook (`POST`, `Authorization: Bearer <supabase access token>`):

```json
{
  "ticket_id": "uuid",
  "reply": "Here is the answer from our team…"
}
```

## Setup

### 1. Environment variables

```bash
cp .env.local.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | Production URL for `/new-ticket` |
| `NEXT_PUBLIC_N8N_STAFF_REPLY_WEBHOOK_URL` | Production URL for `/staff-reply` |

### 2. Run the migrations

Apply files in `supabase/migrations/` in order (`0001`–`0005`).

| Migration | Effect |
| --- | --- |
| `0001_create_tickets.sql` | Base `tickets` table, RLS, Realtime |
| `0002_semantic_search.sql` | `faq` + embeddings + `match_documents` |
| `0003_intent_booking.sql` | Intent/channel columns + `bookings` table |
| `0004_ticket_messages.sql` | `ticket_messages` conversation rows + `tickets.updated_at` |
| `0005_ticket_closed.sql` | `tickets.closed`; confirmed bookings and FAQ auto-replies backfilled closed |

### 3. Create a dashboard user

In **Supabase → Authentication → Users**, create an email/password user.

### 4. Seed FAQ

Run [`n8n-workflow/FAQ embeddings.json`](../n8n-workflow/FAQ%20embeddings.json) once.

### 5. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## App structure

| Path | Purpose |
| --- | --- |
| `/` | Inbox: All / Needs staff / Bookings / Resolved |
| `/tickets/[id]` | Conversation thread, booking info, or **Send & Resolve** |
| `/login` | Email/password sign-in |
| `/submit` | Public form → n8n `/new-ticket` |
| `supabase/migrations/` | Schema source of truth |

## Inbox behavior

- Inbox is **one row per open conversation** (website/email by `customer_email`, Telegram by `contact_id`). Follow-ups bump `updated_at` and stay on the same card until the ticket is **closed**.
- Confirmed bookings and FAQ auto-replies (`auto_resolved`) are closed automatically by n8n. Other tickets have **Close ticket** on the detail page.
- **Needs staff:** `pending_staff` (and legacy `pending_review`), excluding closed
- **Bookings:** `booking_pending` / `booking_confirmed`
- **Resolved:** `resolved` / `auto_resolved` / `closed`
- **Detail:** chat transcript from `ticket_messages` (quoted Gmail/Outlook history is hidden on customer bubbles so a reply like `2026-09-14 10:30:00` is not mixed with the original thread); staff tickets call the staff-reply webhook; booking tickets also show requested/confirmed/suggested slots from `bookings`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
