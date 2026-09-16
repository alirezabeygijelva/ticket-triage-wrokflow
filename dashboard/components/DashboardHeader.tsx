"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type DashboardHeaderProps = {
  email?: string | null;
};

export function DashboardHeader({ email }: DashboardHeaderProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Support
          </p>
          <h1 className="text-lg font-semibold text-zinc-900">
            Ticket Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {email ? (
            <span className="hidden text-sm text-zinc-500 sm:inline">
              {email}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
