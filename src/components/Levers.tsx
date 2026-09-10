"use client";

import type { Lever } from "@/lib/insights";
import { percent, usd } from "@/lib/format";
import { EmptyState } from "@/components/ui";

/**
 * Leviers d'optimisation, classés gains d'abord.
 *
 * La distinction entre les deux familles est la chose importante de cet écran,
 * et elle porte jusque dans le libellé du montant : un gain sans contrepartie
 * affiche un surcoût qu'on peut effacer sans rien perdre, un arbitrage affiche
 * la dépense concernée — jamais une économie promise, puisqu'elle se paierait
 * en qualité.
 */
export function Levers({ levers }: { levers: Lever[] }) {
  if (levers.length === 0) {
    return (
      <EmptyState message="Rien à optimiser sur cette période — c'est une conclusion valable, pas un manque." />
    );
  }

  const free = levers.filter((lever) => lever.kind === "free");
  const tradeoffs = levers.filter((lever) => lever.kind === "tradeoff");
  const freeTotal = free.reduce((sum, lever) => sum + lever.amount, 0);

  return (
    <div className="space-y-6">
      {free.length > 0 && (
        <section>
          <Heading
            title="Gains sans contrepartie"
            note={`${usd(freeTotal)} de surcoût identifié, sans perte de qualité`}
          />
          <ul className="mt-3 space-y-3">
            {free.map((lever) => (
              <LeverRow key={lever.id} lever={lever} />
            ))}
          </ul>
        </section>
      )}

      {tradeoffs.length > 0 && (
        <section>
          <Heading
            title="Arbitrages"
            note="ils échangent du coût contre de l'intelligence — à décider, pas à appliquer d'office"
          />
          <ul className="mt-3 space-y-3">
            {tradeoffs.map((lever) => (
              <LeverRow key={lever.id} lever={lever} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Heading({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--border)] pb-2">
      <h3 className="text-[13px] font-semibold text-[var(--ink)]">{title}</h3>
      <p className="text-[12px] text-[var(--ink-muted)]">{note}</p>
    </div>
  );
}

function LeverRow({ lever }: { lever: Lever }) {
  const isFree = lever.kind === "free";

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="text-[14px] font-medium text-[var(--ink)]">{lever.title}</h4>
        <div className="text-right">
          <span className="tabular text-[17px] font-semibold text-[var(--ink)]">
            {usd(lever.amount)}
          </span>
          <span className="ml-2 text-[12px] text-[var(--ink-muted)]">
            {isFree ? "surcoût évitable" : "dépense concernée"} · {percent(lever.share)} du total
          </span>
        </div>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-secondary)]">
        {lever.finding}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-muted)]">{lever.action}</p>
    </li>
  );
}
