type StatusBadgeProps = {
  status: string | null;
  closed?: boolean;
};

function labelFor(status: string | null, closed?: boolean): string {
  if (closed) return "Closed";
  switch (status) {
    case "pending_staff":
    case "pending_review":
      return "Needs staff";
    case "auto_resolved":
      return "Auto resolved";
    case "resolved":
      return "Resolved";
    case "booking_pending":
      return "Booking pending";
    case "booking_confirmed":
      return "Booking confirmed";
    case "spam":
      return "Spam";
    default:
      return status ?? "Unknown";
  }
}

function styleFor(status: string | null, closed?: boolean): string {
  if (
    closed ||
    status === "resolved" ||
    status === "auto_resolved" ||
    status === "booking_confirmed"
  ) {
    return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  }
  switch (status) {
    case "booking_pending":
      return "bg-teal-50 text-teal-800 ring-teal-200";
    case "spam":
      return "bg-rose-50 text-rose-800 ring-rose-200";
    default:
      return "bg-sky-50 text-sky-800 ring-sky-200";
  }
}

export function StatusBadge({ status, closed }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styleFor(status, closed)}`}
    >
      {labelFor(status, closed)}
    </span>
  );
}
