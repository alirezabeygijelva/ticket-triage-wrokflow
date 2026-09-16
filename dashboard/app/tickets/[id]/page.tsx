import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { TicketDetail } from "@/components/TicketDetail";
import { createClient } from "@/lib/supabase/server";
import type { Booking, Ticket, TicketMessage } from "@/lib/types";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const ticket = data as Ticket;

  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  const booking = (bookingRows?.[0] as Booking | undefined) ?? null;

  const { data: messageRows } = await supabase
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  const messages = (messageRows ?? []) as TicketMessage[];

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader email={user?.email} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
        >
          ← Back to inbox
        </Link>
        <TicketDetail
          key={ticket.id}
          ticket={ticket}
          booking={booking}
          messages={messages}
        />
      </main>
    </div>
  );
}
