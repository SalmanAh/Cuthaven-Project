import type { OrderStatus } from "@/data/orders";

const styles: Record<OrderStatus, string> = {
  Pending: "bg-accent/10 text-accent border-accent/20",
  Processing: "bg-success/10 text-success border-success/20",
  Shipped: "bg-primary/10 text-primary border-primary/20",
  Delivered: "bg-foreground/10 text-foreground border-foreground/20",
  Cancelled: "bg-muted text-text-secondary border-border",
  Failed: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}>{status}</span>;
}

export function PaymentBadge({ status }: { status: "Paid" | "Unpaid" }) {
  const cls = status === "Paid" ? "bg-success/10 text-success border-success/20" : "bg-accent/10 text-accent border-accent/20";
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{status}</span>;
}
