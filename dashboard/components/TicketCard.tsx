import Link from "next/link";
import type { Ticket } from "@/lib/types";
import {
  formatTimestamp,
  stripQuotedEmailReply,
  ticketActivityAt,
  truncate,
} from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

type TicketCardProps = {
  ticket: Ticket;
};

function contactLabel(ticket: Ticket): string {
  if (ticket.channel === "telegram") {
    return ticket.contact_id
      ? `Telegram ${ticket.contact_id}`
      : "Telegram user";
  }
  return ticket.customer_email ?? "No email provided";
}

export function TicketCard({ ticket }: TicketCardProps) {
  const preview = stripQuotedEmailReply(ticket.message);
  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-zinc-900">
            {contactLabel(ticket)}
          </p>
          <p className="text-xs text-zinc-500">
            {formatTimestamp(ticketActivityAt(ticket))}
            {ticket.channel ? ` · ${ticket.channel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ticket.intent ? (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium capitalize text-zinc-700 ring-1 ring-inset ring-zinc-200">
              {ticket.intent}
            </span>
          ) : null}
          {ticket.answer_source && ticket.answer_source !== "not_applicable" ? (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium capitalize text-zinc-700 ring-1 ring-inset ring-zinc-200">
              {ticket.answer_source.replace("_", " ")}
            </span>
          ) : null}
          <StatusBadge status={ticket.status} closed={ticket.closed} />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-600">
        {truncate(preview)}
        {preview.length > 120 ? (
          <span className="ml-1 font-medium text-zinc-900">read more</span>
        ) : null}
      </p>
    </Link>
  );
}
