import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export function PageBreadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-text-secondary">
      <Link to="/" className="hover:text-primary">
        Home
      </Link>
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" />
          {c.to ? (
            <Link to={c.to} className="hover:text-primary">
              {c.label}
            </Link>
          ) : (
            <span className="text-foreground">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
