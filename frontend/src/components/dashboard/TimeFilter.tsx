import type { Period } from "@/data/analytics";

const options: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7days", label: "Last 7 Days" },
  { key: "month", label: "This Month" },
  { key: "annual", label: "Annual" },
];

export function TimeFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex bg-muted rounded-full p-0.5 sm:p-1 border border-border text-[10px] sm:text-xs overflow-x-auto">
      {options.map((o) => (
        <button key={o.key} onClick={() => onChange(o.key)}
          className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium transition whitespace-nowrap ${value === o.key ? "bg-surface shadow-sm text-primary" : "text-text-secondary hover:text-foreground"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
