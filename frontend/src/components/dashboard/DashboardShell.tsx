import { type ReactNode, type ComponentType, useState } from "react";
import { Menu, X } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
}

export function DashboardShell({
  title,
  subtitle,
  sidebarTitle,
  nav,
  activeKey,
  onSelect,
  children,
}: {
  title: string;
  subtitle?: string;
  sidebarTitle: string;
  nav: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-6 md:py-10 grid md:grid-cols-[240px_1fr] gap-6">
        <aside className="hidden md:block">
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-4 sticky top-24">
            <p className="px-3 text-xs uppercase tracking-wide text-text-secondary font-semibold mb-3">
              {sidebarTitle}
            </p>
            <nav className="space-y-1">
              {nav.map((n) => (
                <button
                  key={n.key}
                  onClick={() => (n.onClick ? n.onClick() : onSelect(n.key))}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition ${activeKey === n.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="md:hidden mb-4 flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold">{title}</h1>
              {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
            </div>
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="p-2 rounded-lg border border-border"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <div className="hidden md:block mb-6">
            <h1 className="font-display text-3xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="bg-surface h-full w-[80%] max-w-xs p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between mb-5">
              <span className="font-display font-bold">{sidebarTitle}</span>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {nav.map((n) => (
                <button
                  key={n.key}
                  onClick={() => {
                    n.onClick ? n.onClick() : onSelect(n.key);
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${activeKey === n.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}

export function DashCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface rounded-xl sm:rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5 md:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  trend,
  accent,
}: {
  label: string;
  value: string | number;
  trend?: number;
  accent?: string;
}) {
  return (
    <div
      className={`bg-surface rounded-xl sm:rounded-2xl border border-border shadow-sm p-3 sm:p-4 md:p-5 ${accent ? `border-l-4` : ""}`}
      style={accent ? { borderLeftColor: accent } : undefined}
    >
      <p className="text-[10px] sm:text-xs uppercase tracking-wide text-text-secondary font-medium">
        {label}
      </p>
      <p className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-foreground mt-1">
        {value}
      </p>
      {trend !== undefined && (
        <p
          className={`text-[10px] sm:text-xs mt-1.5 sm:mt-2 font-medium ${trend >= 0 ? "text-success" : "text-destructive"}`}
        >
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs prev period
        </p>
      )}
    </div>
  );
}
