import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  to?: string;
}
export function PageHero({
  title,
  subtitle,
  crumbs = [],
}: {
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
}) {
  return (
    <section className="relative bg-primary text-primary-foreground">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--color-primary-light),_transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-20 text-center">
        <h1 className="font-display text-4xl md:text-5xl font-bold">{title}</h1>
        {subtitle && (
          <p className="mt-3 text-primary-foreground/80 max-w-2xl mx-auto">{subtitle}</p>
        )}
        {crumbs.length > 0 && (
          <nav className="mt-5 flex justify-center items-center gap-1 text-sm text-primary-foreground/80">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5" />
                {c.to ? (
                  <Link to={c.to} className="hover:text-white">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-white">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>
    </section>
  );
}
