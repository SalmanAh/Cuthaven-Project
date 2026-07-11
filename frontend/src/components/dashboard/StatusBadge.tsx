import type { OrderStatus } from "@/data/orders";

// DB uses lowercase, mock data uses Title Case — handle both
type DbStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
type AnyStatus = OrderStatus | DbStatus;

const styles: Record<string, string> = {
  // Title Case (mock data)
  Pending: "bg-accent/10 text-accent border-accent/20",
  Processing: "bg-success/10 text-success border-success/20",
  Shipped: "bg-primary/10 text-primary border-primary/20",
  Delivered: "bg-foreground/10 text-foreground border-foreground/20",
  Cancelled: "bg-muted text-text-secondary border-border",
  Failed: "bg-destructive/10 text-destructive border-destructive/20",
  // lowercase (DB / real orders)
  pending: "bg-accent/10 text-accent border-accent/20",
  confirmed: "bg-success/10 text-success border-success/20",
  processing: "bg-success/10 text-success border-success/20",
  shipped: "bg-primary/10 text-primary border-primary/20",
  delivered: "bg-foreground/10 text-foreground border-foreground/20",
  cancelled: "bg-muted text-text-secondary border-border",
  refunded: "bg-muted text-text-secondary border-border",
};

// Capitalize first letter for display
function label(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  const cls = styles[status] ?? "bg-muted text-text-secondary border-border";
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label(status)}
    </span>
  );
}

export function PaymentBadge({ status }: { status: "Paid" | "Unpaid" }) {
  const cls =
    status === "Paid"
      ? "bg-success/10 text-success border-success/20"
      : "bg-accent/10 text-accent border-accent/20";
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {status}
    </span>
  );
}
