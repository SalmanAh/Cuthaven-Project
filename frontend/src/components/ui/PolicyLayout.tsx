import type { ReactNode } from "react";
import { PageHero } from "@/components/ui/PageHero";

export function PolicyLayout({ title, updated = "June 2025", crumb, children }: { title: string; updated?: string; crumb: string; children: ReactNode }) {
  return (
    <div>
      <PageHero title={title} crumbs={[{ label: crumb }]} />
      <article className="mx-auto max-w-3xl px-4 py-12 prose prose-neutral max-w-none">
        <p className="text-sm text-text-secondary">Last updated: {updated}</p>
        {children}
      </article>
    </div>
  );
}
