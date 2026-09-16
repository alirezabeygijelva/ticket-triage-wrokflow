type StatusFilter = "all" | "pending_staff" | "bookings" | "resolved";

const tabs: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending_staff", label: "Needs staff" },
  { id: "bookings", label: "Bookings" },
  { id: "resolved", label: "Resolved" },
];

type StatusTabsProps = {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
};

export function StatusTabs({ value, onChange }: StatusTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export type { StatusFilter };

export function ticketMatchesStatusFilter(
  ticket: { status: string | null; closed?: boolean | null },
  filter: StatusFilter,
): boolean {
  const closed = Boolean(ticket.closed);
  const status = ticket.status;
  if (filter === "all") return true;
  if (filter === "pending_staff") {
    return (
      !closed &&
      (status === "pending_staff" || status === "pending_review")
    );
  }
  if (filter === "bookings") {
    return status === "booking_pending" || status === "booking_confirmed";
  }
  if (filter === "resolved") {
    return closed || status === "resolved" || status === "auto_resolved";
  }
  return false;
}
