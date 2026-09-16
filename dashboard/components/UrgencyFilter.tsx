type UrgencyFilterValue = "all" | "high" | "medium" | "low";

type UrgencyFilterProps = {
  value: UrgencyFilterValue;
  onChange: (value: UrgencyFilterValue) => void;
};

export function UrgencyFilter({ value, onChange }: UrgencyFilterProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600">
      <span className="whitespace-nowrap font-medium">Urgency</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as UrgencyFilterValue)
        }
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-400"
      >
        <option value="all">All</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </label>
  );
}

export type { UrgencyFilterValue };
