"use client";

import type { LimitWindow, RateLimits } from "@/lib/limits";
import { duration, formatDateTime, percent, timeAgo } from "@/lib/format";

/** Seuils à partir desquels la jauge change de ton. */
const WARNING_AT = 0.7;
const CRITICAL_AT = 0.9;

function tone(used: number): string {
  if (used >= CRITICAL_AT) return "var(--status-critical)";
  if (used >= WARNING_AT) return "var(--status-warning)";
  return "var(--accent)";
}

function Gauge({
  label,
  limit,
  now,
  longReset,
}: {
  label: string;
  limit: LimitWindow | null;
  now: number;
  /** Une échéance lointaine se lit mieux en date qu'en compte à rebours. */
  longReset: boolean;
}) {
  if (!limit) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-5">
        <p className="text-[13px] text-[var(--ink-secondary)]">{label}</p>
        <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">Pas encore de relevé.</p>
      </div>
    );
  }

  // Le relevé date du dernier passage de la statusline : si l'échéance est
  // dépassée depuis, la fenêtre s'est vidée entre-temps.
  const resetAt = limit.resetsAt ? Date.parse(limit.resetsAt) : null;
  const expired = resetAt !== null && resetAt <= now;
  const used = expired ? 0 : limit.used;

  let resetText = "échéance inconnue";
  if (expired) resetText = "réinitialisée depuis le dernier relevé";
  else if (resetAt !== null) {
    resetText = longReset
      ? `réinitialisation le ${formatDateTime(limit.resetsAt!)}`
      : `réinitialisation dans ${duration(resetAt - now)}`;
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-[var(--ink-secondary)]">{label}</p>
        <p className="tabular text-[26px] font-semibold leading-tight text-[var(--ink)]">
          {percent(used)}
        </p>
      </div>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--ramp-1)" }}
        role="meter"
        aria-valuenow={Math.round(used * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} : part consommée`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${used > 0 ? Math.max(1, used * 100) : 0}%`, background: tone(used) }}
        />
      </div>
      <p className="mt-1.5 text-[12px] text-[var(--ink-muted)]">{resetText}</p>
    </div>
  );
}

/**
 * Jauges des limites d'usage Claude : fenêtre de 5 heures et semaine.
 *
 * Contrairement au reste du tableau de bord, ces pourcentages ne se déduisent
 * pas des transcripts : ils viennent d'Anthropic, relayés par la statusline.
 */
export function UsageLimits({ limits, now }: { limits: RateLimits | null; now: number }) {
  if (!limits) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-[13px] leading-relaxed text-[var(--ink-secondary)]">
        Les jauges de session et de semaine s&apos;affichent une fois la statusline de Tempo
        installée. Dans{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[12px]">
          ~/.claude/settings.json
        </code>{" "}
        :
        <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-sunken)] p-3 text-[12px]">
          {`"statusLine": { "type": "command", "command": "node <tempo>/scripts/statusline.mjs" }`}
        </pre>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Gauge label="Session (5 heures)" limit={limits.session} now={now} longReset={false} />
        <Gauge label="Semaine" limit={limits.week} now={now} longReset />
      </div>
      <p className="mt-1.5 text-right text-[12px] text-[var(--ink-muted)]">
        Relevé {timeAgo(limits.capturedAt, now)} via la statusline Claude Code
      </p>
    </div>
  );
}
