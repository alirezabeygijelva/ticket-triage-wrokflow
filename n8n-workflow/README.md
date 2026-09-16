# n8n workflows

| File | Workflow name | Purpose |
| --- | --- | --- |
| [`FAQ embeddings.json`](./FAQ%20embeddings.json) | **FAQ embeddings** | One-shot seed: sample FAQs → Gemini embeddings → Supabase `faq` |
| [`ticket-triage-workflow.json`](./ticket-triage-workflow.json) | **Ticket Manager** | Multi-channel intake, intent routing, Calendar booking, staff reply |

Run **FAQ embeddings** at least once after applying migrations `0001`–`0005`, then activate **Ticket Manager**.

## Credential policy

Exports use placeholder credential references (`REPLACE_ME_*`) and placeholder emails (`support@example.com`). Reconnect credentials after import.

---

## 1. FAQ embeddings

Unchanged one-shot seeder for the `faq` vector store. See previous setup: attach Gemini + Supabase (service role), execute once.

---

## 2. Ticket Manager

### Import

1. Import `ticket-triage-workflow.json`.
2. Reconnect credentials on every warning node.
3. Update `support@example.com` on Email nodes (FAQ / Staff Wait / Booking / Staff Reply).
4. On **Validate Staff Session**, set the URL to `https://<your-project-ref>.supabase.co/auth/v1/user` and the `apikey` header to your Supabase anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
5. Activate and copy production URLs:
   - `/new-ticket` → dashboard `NEXT_PUBLIC_N8N_WEBHOOK_URL`
   - `/staff-reply` → dashboard `NEXT_PUBLIC_N8N_STAFF_REPLY_WEBHOOK_URL`

### Credentials required

| Credential type | Used by |
| --- | --- |
| Google Gemini (PaLM) API | Chat model + embeddings |
| Supabase API | Tickets / bookings / FAQ search (prefer **service role**) |
| SMTP | Email replies |
| HTTP Header Auth | Groq fallback (`Authorization: Bearer …`) |
| Gmail OAuth2 | Email intake trigger |
| Telegram | Intake + outbound replies |
| Google Calendar OAuth2 | Availability + create event |

### Intake contracts

**Website webhook** `POST /new-ticket`:

```json
{
  "ticket_message": "string",
  "customer_email": "string"
}
```

Also: **Gmail Trigger** and **Telegram Trigger** normalize to `ticket_message`, `channel`, and `customer_email` / `contact_id`.

**Data Email** keeps only the latest reply. Gmail `text` (then `snippet`) is cut at `On … wrote:`, Outlook `Original Message` / `From:`/`Sent:`, and `>` quoted lines, so a reply like `2026-09-14 10:30:00` is not mixed with an older “tomorrow at 18”. Re-import the workflow after this change.

**Staff reply** `POST /staff-reply` (requires `Authorization: Bearer <supabase access token>`):

```json
{
  "ticket_id": "uuid",
  "reply": "string"
}
```

n8n sends that Bearer token to Supabase `GET /auth/v1/user`. No user `id` → **401** and the ticket is not updated. After a valid session, it replies on the original channel and returns **200** `{ "ok": true }`.

The export ships with `https://your-project-ref.supabase.co/auth/v1/user` and `REPLACE_ME_SUPABASE_ANON_KEY` on **Validate Staff Session**. Replace both with the same project as the dashboard.

### Pipeline

```
Website / Gmail / Telegram
  → normalize (channel + contact)
  → AI Agent (Gemini + FAQ tool)
       ├ success → Parse Gemini Response
       └ error   → Vector Search → Groq → Parse Groq Response
  → find existing **open** ticket by identity (or create; skip `closed`)
  → insert customer row on ticket_messages
  → Switch intent
       ├ question → Answer Source (faq | staff_needed) → Email/Telegram + log bot message
       ├ booking  → Calendar events → Evaluate Booking
       │              ├ confirmed → create event + bookings + confirm message + close ticket
       │              ├ suggested → store 2 slots + message
       │              └ ask_time  → ask for preferred time
       └ spam     → stop (status spam, no customer message)
Staff Reply Webhook
  → GET Supabase /auth/v1/user (Bearer token)
       ├ invalid → 401
       └ valid → load ticket → Email/Telegram by channel → log staff message → mark resolved → 200
```

### Threading (edit in the n8n editor)

Do this on the **Ticket Manager** canvas. One **open** ticket per customer per channel: website/email by `customer_email`, Telegram by `contact_id`. Apply migrations `0004` and `0005` first. Confirmed bookings and FAQ auto-replies set `closed=true`; other tickets stay open until **Close ticket** in the dashboard. n8n never appends to a closed ticket.

Insert this chain **between** Parse Gemini/Groq and **Switch**:

`Lookup Identity` → Find Ticket (Telegram or email) → `Resolve Thread` → `Has Existing Ticket` → Update **or** Create a row → `Insert Customer Message` → `Ticket Ready` → **Switch**

- **Lookup Identity** (Switch): `channel === telegram` vs everyone else.
- **Find Ticket Telegram**: Supabase getAll `tickets`, `channel=telegram` and `contact_id`, always output data.
- **Find Ticket Email**: Supabase getAll `tickets`, `channel` + `customer_email`, always output data.
- **Has Existing Ticket** (IF): `existing_ticket_id` is not empty.
- **Update Ticket Thread**: update that `id` with latest `message`, `next_intent`, `answer_source`, `extracted_datetime`, `suggested_reply`, `next_status`, `updated_at`; set `closed` = true when `next_status` is `auto_resolved`.
- **Create a row**: add field `updated_at` = `{{ $now.toISO() }}` and `closed` = true when the new ticket is `auto_resolved`.
- **Update Ticket Confirmed**: also set `closed` = `true`.
- **Insert Customer Message**: table `ticket_messages`, `ticket_id=$json.id`, `role=customer`, `body=$json.message`.

**Resolve Thread** Code (picks newest match; does not let spam overwrite a real thread):

```javascript
function getParsed() {
  for (const name of ['Parse Gemini Response', 'Parse Groq Response']) {
    try {
      const d = $(name).first().json;
      if (d && d.ticket_message !== undefined) return d;
    } catch (e) {}
  }
  return {};
}
const parsed = getParsed();
const found = $input.all().map((i) => i.json).filter((row) => row && row.id && row.message !== undefined);
found.sort((a, b) => Date.parse(b.updated_at || b.created_at || 0) - Date.parse(a.updated_at || a.created_at || 0));
const existing = found.find((row) => row.closed !== true) || null;
const identity = parsed.channel === 'telegram'
  ? String(parsed.contact_id || '').trim()
  : String(parsed.customer_email || '').trim();
const canReuse = Boolean(identity && existing);
let nextIntent = parsed.intent;
let nextStatus = parsed.intent === 'spam' ? 'spam' : (parsed.intent === 'booking' ? 'booking_pending' : (parsed.answer_source === 'faq' ? 'auto_resolved' : 'pending_staff'));
if (canReuse && parsed.intent === 'spam' && existing.status && existing.status !== 'spam') {
  nextIntent = existing.intent;
  nextStatus = existing.status;
}
return [{ json: { ...parsed, existing_ticket_id: canReuse ? existing.id : null, next_intent: nextIntent, next_status: nextStatus } }];
```

**Ticket Ready** Code (so Switch / booking still see `id`):

```javascript
function getParsed() {
  for (const name of ['Parse Gemini Response', 'Parse Groq Response']) {
    try {
      const d = $(name).first().json;
      if (d && d.ticket_message !== undefined) return d;
    } catch (e) {}
  }
  return {};
}
function getTicket() {
  for (const name of ['Update Ticket Thread', 'Create a row']) {
    try {
      const d = $(name).first().json;
      if (d && d.id) return d;
    } catch (e) {}
  }
  return {};
}
const parsed = getParsed();
const ticket = getTicket();
const resolved = $('Resolve Thread').first().json;
return [{ json: { ...parsed, ...ticket, id: ticket.id, ticket_id: ticket.id, message: parsed.ticket_message || ticket.message, intent: resolved.next_intent || parsed.intent, status: resolved.next_status || ticket.status, suggested_reply: parsed.reply_if_question || ticket.suggested_reply } }];
```

Then in **Merge Ticket Events**, **Evaluate Booking**, and booking confirmed nodes, replace `$('Create a row')` with `$('Ticket Ready')`.

After outbound sends, insert `ticket_messages`:

| After these nodes | role | body |
| --- | --- | --- |
| FAQ Telegram / FAQ Email | `bot` | `$('Ticket Ready').item.json.suggested_reply` |
| Staff Wait Telegram / Staff Wait Email | `bot` | `Thanks for your question. A staff member will answer shortly and we will send the reply here.` |
| Booking Telegram / Booking Email | `bot` | `$('Evaluate Booking').item.json.outbound_text` |
| Staff Reply Telegram / Staff Reply Email | `staff` | `$('Prepare Staff Reply').item.json.reply` |

Staff path: send → log staff message → **Mark Ticket Resolved** (also set `updated_at`). Keep `bookings.ticket_id` on the same thread.

### Agent JSON contract

```json
{
  "intent": "booking|question|spam",
  "answer_source": "faq|staff_needed|not_applicable",
  "reply_if_question": "string or null",
  "extracted_datetime": "YYYY-MM-DDTHH:mm:00 or null"
}
```

### Ticket statuses written by the workflow

| Status | Meaning |
| --- | --- |
| `auto_resolved` | FAQ answer sent (ticket is also `closed`) |
| `pending_staff` | Waiting for human; user notified |
| `resolved` | Staff reply sent via `/staff-reply` |
| `booking_pending` | Awaiting time / user choice |
| `booking_confirmed` | Calendar event created |
| `spam` | Ignored |

### Booking defaults

- Duration: **30 minutes**
- Hours: **Mon–Fri 09:00–17:00 Asia/Istanbul**
- If busy: suggest the next **2** free slots
- User confirms an alternate by sending another message on the **same ticket thread** (re-enters booking path)

### Testing

```bash
curl -X POST "https://<n8n-host>/webhook/new-ticket" \
  -H "Content-Type: application/json" \
  -d "{\"ticket_message\":\"What are your hours?\",\"customer_email\":\"you@example.com\"}"
```

```bash
curl -X POST "https://<n8n-host>/webhook/staff-reply" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-access-token>" \
  -d "{\"ticket_id\":\"<uuid>\",\"reply\":\"Here is our answer.\"}"
```

## Related

- [Root project README](../README.md)
- [Dashboard README](../dashboard/README.md)
