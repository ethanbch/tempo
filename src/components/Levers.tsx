"use client";

import type { Lever } from "@/lib/insights";
import type { Format } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import { modelLabel } from "@/lib/pricing";
import { useI18n } from "@/components/I18nProvider";
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
  const { t, f } = useI18n();

  if (levers.length === 0) {
    return <EmptyState message={t.levers.empty} />;
  }

  const free = levers.filter((lever) => lever.kind === "free");
  const tradeoffs = levers.filter((lever) => lever.kind === "tradeoff");
  const freeTotal = free.reduce((sum, lever) => sum + lever.amount, 0);

  return (
    <div className="space-y-6">
      {free.length > 0 && (
        <section>
          <Heading title={t.levers.freeTitle} note={t.levers.freeNote(f.usd(freeTotal))} />
          <ul className="mt-3 space-y-3">
            {free.map((lever) => (
              <LeverRow key={lever.id} lever={lever} />
            ))}
          </ul>
        </section>
      )}

      {tradeoffs.length > 0 && (
        <section>
          <Heading title={t.levers.tradeoffTitle} note={t.levers.tradeoffNote} />
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

/** Met en mots les faits d'un levier, dans la langue choisie. */
function describe(lever: Lever, t: Messages, f: Format) {
  const cost = f.usd(lever.amount);
  switch (lever.id) {
    case "idle-timeout": {
      const text = t.levers.idleTimeout;
      return {
        title: text.title,
        finding: text.finding(lever.requests, f.compactTokens(lever.tokens), cost),
        action: text.action,
      };
    }
    case "cache-invalidation": {
      const text = t.levers.cacheInvalidation;
      const causes = lever.switches
        .map((entry) => `${t.causes[entry.cause].toLocaleLowerCase()} (${f.integer(entry.requests)})`)
        .join(", ");
      return { title: text.title, finding: text.finding(cost, causes), action: text.action };
    }
    case "long-context": {
      const text = t.levers.longContext;
      const threshold = f.compactTokens(lever.thresholdTokens);
      return {
        title: text.title,
        finding: text.finding(lever.requests, threshold, cost, f.compactTokens(lever.peakTokens)),
        action: text.action(threshold),
      };
    }
    case "sidechains": {
      const text = t.levers.sidechains;
      return { title: text.title, finding: text.finding(cost), action: text.action };
    }
    case "effort": {
      const text = t.levers.effort;
      return {
        title: text.title,
        finding: text.finding(cost, f.percent(lever.thinkingShare, 1)),
        action: text.action,
      };
    }
    case "model-mix": {
      const text = t.levers.modelMix;
      return {
        title: text.title,
        finding: text.finding(modelLabel(lever.model), f.percent(lever.share), f.integer(lever.requests)),
        action: text.action,
      };
    }
  }
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
  const { t, f } = useI18n();
  const isFree = lever.kind === "free";
  const { title, finding, action } = describe(lever, t, f);

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="text-[14px] font-medium text-[var(--ink)]">{title}</h4>
        <div className="text-right">
          <span className="tabular text-[17px] font-semibold text-[var(--ink)]">
            {f.usd(lever.amount)}
          </span>
          <span className="ml-2 text-[12px] text-[var(--ink-muted)]">
            {isFree ? t.levers.avoidable : t.levers.involved} · {t.levers.ofTotal(f.percent(lever.share))}
          </span>
        </div>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-secondary)]">{finding}</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-muted)]">{action}</p>
    </li>
  );
}
