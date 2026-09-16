"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import type { Booking, Ticket, TicketMessage } from "@/lib/types";
import {
  formatTimestamp,
  stripQuotedEmailReply,
  ticketActivityAt,
} from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

type TicketDetailProps = {
  ticket: Ticket;
  booking: Booking | null;
  messages: TicketMessage[];
};

function contactLabel(ticket: Ticket): string {
  if (ticket.channel === "telegram") {
    return ticket.contact_id
      ? `Telegram ${ticket.contact_id}`
      : "Telegram user";
  }
  return ticket.customer_email ?? "No email provided";
}

function normalizeSlots(slots: unknown): string[] {
  if (!slots) return [];
  if (Array.isArray(slots)) return slots.filter((s) => typeof s === "string");
  if (typeof slots === "string") {
    try {
      const parsed: unknown = JSON.parse(slots);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatSlots(slots: unknown): string {
  const list = normalizeSlots(slots);
  if (!list.length) return "None";
  return list.map((s) => s.replace("T", " ")).join(" · ");
}

function roleLabel(role: TicketMessage["role"]): string {
  if (role === "customer") return "Customer";
  if (role === "staff") return "Staff";
  return "Bot";
}

function mergeMessages(
  base: TicketMessage[],
  extra: TicketMessage[],
): TicketMessage[] {
  const byId = new Map<string, TicketMessage>();
  for (const row of base) byId.set(row.id, row);
  for (const row of extra) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    return aTime - bTime;
  });
}

export function TicketDetail({
  ticket,
  booking,
  messages: initialMessages,
}: TicketDetailProps) {
  const router = useRouter();
  const [reply, setReply] = useState(
    ticket.staff_reply ?? ticket.suggested_reply ?? "",
  );
  const [status, setStatus] = useState(ticket.status);
  const [intent, setIntent] = useState(ticket.intent);
  const [answerSource, setAnswerSource] = useState(ticket.answer_source);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeMessages, setRealtimeMessages] = useState<TicketMessage[]>(
    [],
  );
  const [closed, setClosed] = useState(Boolean(ticket.closed));
  const messages = useMemo(
    () =>
      mergeMessages(
        initialMessages,
        realtimeMessages.filter((row) => row.ticket_id === ticket.id),
      ),
    [initialMessages, realtimeMessages, ticket.id],
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload: RealtimePostgresChangesPayload<TicketMessage>) => {
          const next = payload.new as TicketMessage;
          if (!next?.id) return;
          setRealtimeMessages((current) => mergeMessages(current, [next]));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tickets",
          filter: `id=eq.${ticket.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Ticket>) => {
          const next = payload.new as Ticket;
          if (next.status) setStatus(next.status);
          if (next.intent) setIntent(next.intent);
          if (next.answer_source) setAnswerSource(next.answer_source);
          if (typeof next.closed === "boolean") setClosed(next.closed);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticket.id]);

  const thread = useMemo(() => {
    if (messages.length) return messages;
    return [
      {
        id: `legacy-${ticket.id}`,
        ticket_id: ticket.id,
        role: "customer" as const,
        body: ticket.message,
        created_at: ticket.created_at,
      },
    ];
  }, [messages, ticket]);

  const needsStaff =
    !closed &&
    (status === "pending_staff" || status === "pending_review");
  const hasBotReply = thread.some((row) => row.role === "bot");
  const isFaq = answerSource === "faq" || status === "auto_resolved";
  const isBooking =
    intent === "booking" ||
    status === "booking_pending" ||
    status === "booking_confirmed";

  async function getStaffAccessToken(): Promise<string | null> {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function sendAndResolve() {
    const trimmed = reply.trim();
    if (!trimmed) {
      setError("Write a reply before sending.");
      return;
    }

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_STAFF_REPLY_WEBHOOK_URL;
    if (!webhookUrl) {
      setError("Staff reply webhook URL is not configured.");
      return;
    }

    const token = await getStaffAccessToken();
    if (!token) {
      setError("Your session expired. Sign in again to send a reply.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticket_id: ticket.id,
          reply: trimmed,
        }),
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Staff reply was rejected. Sign in again and retry."
            : `Request failed with status ${response.status}`,
        );
      }

      setStatus("resolved");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send staff reply.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function closeTicket() {
    setClosing(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("tickets")
        .update({ closed: true, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setClosed(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close ticket.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">Customer</p>
            <h1 className="mt-1 text-xl font-semibold text-zinc-900">
              {contactLabel(ticket)}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {formatTimestamp(ticketActivityAt(ticket))}
              {ticket.channel ? ` · ${ticket.channel}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {intent ? (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium capitalize text-zinc-700 ring-1 ring-inset ring-zinc-200">
                {intent}
              </span>
            ) : null}
            {answerSource && answerSource !== "not_applicable" ? (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium capitalize text-zinc-700 ring-1 ring-inset ring-zinc-200">
                {answerSource.replace("_", " ")}
              </span>
            ) : null}
            <StatusBadge status={status} closed={closed} />
            {!closed ? (
              <button
                type="button"
                onClick={() => void closeTicket()}
                disabled={closing}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {closing ? "Closing…" : "Close ticket"}
              </button>
            ) : null}
          </div>
        </div>

        {error && !needsStaff && status !== "resolved" ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-900">Conversation</h2>
          <ol className="mt-3 space-y-3">
            {thread.map((row) => {
              const isCustomer = row.role === "customer";
              const bubbleClass = isCustomer
                ? "bg-zinc-900 text-white"
                : row.role === "staff"
                  ? "bg-indigo-50 text-indigo-950 ring-1 ring-inset ring-indigo-100"
                  : "bg-emerald-50 text-emerald-950 ring-1 ring-inset ring-emerald-100";
              return (
                <li
                  key={row.id}
                  className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${bubbleClass}`}>
                    <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">
                      {roleLabel(row.role)}
                      {row.created_at
                        ? ` · ${formatTimestamp(row.created_at)}`
                        : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                      {row.role === "customer"
                        ? stripQuotedEmailReply(row.body)
                        : row.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {isFaq && !hasBotReply ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-zinc-900">FAQ answer sent</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {ticket.suggested_reply ?? "No answer recorded."}
          </p>
        </div>
      ) : null}

      {isBooking ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-medium text-zinc-900">Booking</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Requested time</dt>
              <dd className="mt-1 text-zinc-900">
                {ticket.extracted_datetime
                  ? formatTimestamp(ticket.extracted_datetime)
                  : "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Booking status</dt>
              <dd className="mt-1 capitalize text-zinc-900">
                {booking?.status ?? status ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Confirmed start</dt>
              <dd className="mt-1 text-zinc-900">
                {booking?.confirmed_start
                  ? formatTimestamp(booking.confirmed_start)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Suggested slots</dt>
              <dd className="mt-1 text-zinc-900">
                {formatSlots(booking?.suggested_slots)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {needsStaff || status === "resolved" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <label
            htmlFor="staff-reply"
            className="text-sm font-medium text-zinc-900"
          >
            Staff reply
          </label>
          <textarea
            id="staff-reply"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={8}
            disabled={!needsStaff}
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white disabled:opacity-70"
          />

          {error ? (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          ) : null}

          {needsStaff ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void sendAndResolve()}
                disabled={saving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Sending…" : "Send & Resolve"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
