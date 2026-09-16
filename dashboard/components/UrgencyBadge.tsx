import type { TicketUrgency } from "@/lib/types";

const styles: Record<string, string> = {
  high: "bg-red-100 text-red-800 ring-red-200",
  medium: "bg-amber-100 text-amber-800 ring-amber-200",
  low: "bg-emerald-100 text-emerald-800 ring-emerald-200",
};

type UrgencyBadgeProps = {
  urgency: string | null;
};

export function UrgencyBadge({ urgency }: UrgencyBadgeProps) {
  const key = (urgency ?? "").toLowerCase() as TicketUrgency;
  const className = styles[key] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${className}`}
    >
      {urgency ?? "unknown"}
    </span>
  );
}
