"use client";

import type { QuotaBlock } from "@/lib/aggregate";
import { QUOTA_WINDOW_MS } from "@/lib/aggregate";
import { compactTokens, duration, formatDateTime, integer, percent, usd } from "@/lib/format";
import { EmptyState } from "@/components/ui";

/**
 * Fenêtres de quota de 5 heures.
 *
 * Anthropic ne publie pas de plafond chiffré en tokens pour les abonnements Pro
 * et Max, et l'inventer donnerait une jauge fausse. La jauge se lit donc par
 * rapport à la fenêtre la plus chargée de l'historique de l'utilisateur : elle
 * dit « cette session-ci pèse tant, comparée à ta plus lourde », ce qui est
 * mesurable, plutôt qu'un pourcentage d'un plafond inconnu.
 */
export function QuotaWindows({ blocks, now }: { blocks: QuotaBlock[]; now: number }) {
  if (blocks.length === 0) {
    return <EmptyState message="Aucune fenêtre d'activité sur cette période." />;
  }

  const peak = Math.max(...blocks.map((block) => block.cost));
  const active = blocks.find((block) => block.active) ?? null;
  const recent = [...blocks].reverse().slice(0, 6);

  const elapsed = active ? now - Date.parse(active.start) : 0;
  const remaining = active ? Math.max(0, Date.parse(active.end) - now) : 0;
  const share = active && peak > 0 ? Math.min(1, active.cost / peak) : 0;

  return (
    <div>
      {active ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: "var(--status-good)" }}
              />
              <span className="text-[13px] font-medium text-[var(--ink)]">Fenêtre en cours</span>
              <span className="text-[12px] text-[var(--ink-muted)]">
                ouverte {duration(elapsed)} · il reste {duration(remaining)}
              </span>
            </div>
            <span className="tabular text-[13px] text-[var(--ink-secondary)]">
              {integer(active.requests)} requêtes · {compactTokens(active.totalTokens)} tokens
            </span>
          </div>

          <p className="mt-3 text-[32px] font-semibold leading-none text-[var(--ink)]">
            {usd(active.cost)}
          </p>

          <div className="mt-3">
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: "var(--ramp-1)" }}
              role="meter"
              aria-valuenow={Math.round(share * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Poids de la fenêtre en cours, comparé à la fenêtre la plus chargée"
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, share * 100)}%`, background: "var(--accent)" }}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-[var(--ink-muted)]">
              {percent(share)} de ta fenêtre la plus chargée ({usd(peak)})
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-[13px] text-[var(--ink-secondary)]">
          Aucune fenêtre ouverte. La prochaine requête en démarrera une nouvelle, valable{" "}
          {duration(QUOTA_WINDOW_MS)}.
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {recent.map((block) => {
          const width = peak > 0 ? Math.max(2, (block.cost / peak) * 100) : 2;
          return (
            <li key={block.start} className="flex items-center gap-3">
              <span className="tabular w-[92px] shrink-0 text-[12px] text-[var(--ink-muted)]">
                {formatDateTime(block.start)}
              </span>
              <span className="h-2 flex-1 rounded-full" style={{ background: "var(--ramp-1)" }}>
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${width}%`,
                    background: block.active ? "var(--accent)" : "var(--series-1)",
                    opacity: block.active ? 1 : 0.55,
                  }}
                />
              </span>
              <span className="tabular w-[72px] shrink-0 text-right text-[12px] text-[var(--ink-secondary)]">
                {usd(block.cost)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
