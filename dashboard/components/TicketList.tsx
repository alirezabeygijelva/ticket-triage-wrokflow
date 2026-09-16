"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import type { Ticket } from "@/lib/types";
import { TicketCard } from "@/components/TicketCard";
import {
  StatusTabs,
  ticketMatchesStatusFilter,
  type StatusFilter,
} from "@/components/StatusTabs";

function activityTime(ticket: Ticket): number {
  return Date.parse(ticket.updated_at || ticket.created_at || "") || 0;
}

function upsertTicket(list: Ticket[], ticket: Ticket): Ticket[] {
  const without = list.filter((item) => item.id !== ticket.id);
  return [ticket, ...without].sort((a, b) => activityTime(b) - activityTime(a));
}

export function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const loadTickets = useCallback(async () => {
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("tickets")
      .select("*")
      .order("updated_at", { ascending: false, nullsFirst: false });

    if (fetchError) {
      setError(fetchError.message);
      setTickets([]);
    } else {
      setError(null);
      setTickets((data ?? []) as Ticket[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTickets();

    const supabase = createClient();
    const channel = supabase
      .channel("tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload: RealtimePostgresChangesPayload<Ticket>) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<Ticket>;
            if (oldRow.id) {
              setTickets((current) =>
                current.filter((ticket) => ticket.id !== oldRow.id),
              );
            }
            return;
          }

          const next = payload.new as Ticket;
          if (!next?.id) return;
          setTickets((current) => upsertTicket(current, next));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadTickets]);

  const filtered = useMemo(() => {
    return tickets.filter((ticket) =>
      ticketMatchesStatusFilter(ticket, statusFilter),
    );
  }, [tickets, statusFilter]);

  return (
    <div className="space-y-6">
      <StatusTabs value={statusFilter} onChange={setStatusFilter} />

      {loading ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
          Loading tickets…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
          Failed to load tickets: {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
          No tickets match the current filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((ticket) => (
            <li key={ticket.id}>
              <TicketCard ticket={ticket} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
