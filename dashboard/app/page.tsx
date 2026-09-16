import { DashboardHeader } from "@/components/DashboardHeader";
import { TicketList } from "@/components/TicketList";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader email={user?.email} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Inbox
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Tickets arrive in realtime when n8n inserts a new row into Supabase.
          </p>
        </div>
        <TicketList />
      </main>
    </div>
  );
}
