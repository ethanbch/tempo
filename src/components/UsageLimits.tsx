"use client";

import type { Format } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import type { LimitAnalysis, LimitKind, LimitsReport } from "@/lib/limits";
import { useI18n } from "@/components/I18nProvider";
import { Card } from "@/components/ui";

/** Seuils à partir desquels la jauge change de ton. */
const WARNING_AT = 0.7;
const CRITICAL_AT = 0.9;

function tone(used: number): string {
  if (used >= CRITICAL_AT) return "var(--status-critical)";
  if (used >= WARNING_AT) return "var(--status-warning)";
  return "var(--accent)";
}

/**
 * Courbe de la fenêtre en cours, de son ouverture à sa réinitialisation : la
 * consommation relevée en trait plein, la projection au rythme récent en
 * pointillé. Le haut du cadre est la limite.
 */
function PaceChart({ analysis, now }: { analysis: LimitAnalysis; now: number }) {
  if (!analysis.windowStart || !analysis.resetsAt || analysis.series.length === 0) return null;

  const start = Date.parse(analysis.windowStart);
  const end = Date.parse(analysis.resetsAt);
  const x = (time: number) => ((Math.min(Math.max(time, start), end) - start) / (end - start)) * 1000;
  const y = (used: number) => 100 - Math.min(1, used) * 100;

  // Escalier : la consommation reste au dernier relevé jusqu'au suivant.
  const points = analysis.series.map((point) => ({ at: Date.parse(point.at), used: point.used }));
  const first = `${x(points[0].at)} ${y(points[0].used)}`;
  let steps = "";
  for (const point of points.slice(1)) {
    steps += ` H ${x(point.at)} V ${y(point.used)}`;
  }
  steps += ` H ${x(now)}`;
  const line = `M ${first}${steps}`;
  // Une fenêtre s'ouvre toujours à 0 % : avant le premier relevé, le chemin est
  // inconnu, on le relie d'un trait discret plutôt que de laisser un vide.
  const lead = `M ${x(start)} ${y(0)} L ${first}`;
  const area = `M ${x(start)} 100 L ${first}${steps} V 100 Z`;

  const { projection } = analysis;
  let projected: string | null = null;
  if (projection && projection.ratePerHour > 0) {
    const target = projection.hitsAt
      ? { at: Date.parse(projection.hitsAt), used: 1 }
      : { at: end, used: projection.usedAtReset };
    projected = `M ${x(now)} ${y(analysis.used)} L ${x(target.at)} ${y(target.used)}`;
  }

  const color = tone(analysis.used);
  return (
    <svg
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      className="mt-3 block h-14 w-full overflow-visible"
      aria-hidden
    >
      <line
        x1={0}
        x2={1000}
        y1={0}
        y2={0}
        stroke="var(--border)"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={x(now)}
        x2={x(now)}
        y1={0}
        y2={100}
        stroke="var(--border)"
        vectorEffect="non-scaling-stroke"
      />
      <path d={area} fill={color} opacity={0.12} />
      <path
        d={lead}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.35}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {projected && (
        <path
          d={projected}
          fill="none"
          stroke={projection?.hitsAt ? "var(--status-critical)" : color}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

function resetText(kind: LimitKind, analysis: LimitAnalysis, now: number, t: Messages, f: Format) {
  if (analysis.expired) return t.limits.expired;
  if (!analysis.resetsAt) return t.limits.unknownReset;
  const remaining = f.countdown(Date.parse(analysis.resetsAt) - now);
  return kind === "session"
    ? t.limits.sessionReset(f.formatTime(analysis.resetsAt), remaining)
    : t.limits.weekReset(remaining, f.formatDateTime(analysis.resetsAt));
}

function paceText(
  kind: LimitKind,
  analysis: LimitAnalysis,
  t: Messages,
  f: Format,
): { text: string; alarming: boolean } | null {
  const { projection } = analysis;
  if (!projection) return null;
  if (projection.hitsAt) {
    const when =
      kind === "session" ? f.formatTime(projection.hitsAt) : f.formatDateTime(projection.hitsAt);
    return { text: t.limits.hitsAt(when), alarming: true };
  }
  if (projection.ratePerHour === 0) {
    return { text: kind === "session" ? t.limits.idleSession : t.limits.idleWeek, alarming: false };
  }
  return { text: t.limits.atReset(f.percent(projection.usedAtReset)), alarming: false };
}

function Gauge({
  kind,
  analysis,
  now,
}: {
  kind: LimitKind;
  analysis: LimitAnalysis | null;
  now: number;
}) {
  const { t, f } = useI18n();
  const title = kind === "session" ? t.limits.session : t.limits.week;
  if (!analysis) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] p-4">
        <p className="text-[13px] text-[var(--ink-secondary)]">{title}</p>
        <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">{t.limits.noReading}</p>
      </div>
    );
  }

  const { used, cap } = analysis;
  const pace = paceText(kind, analysis, t, f);
  const capText = cap
    ? (kind === "session" ? t.limits.capSession : t.limits.capWeek)(
        f.usd(cap.costPerPercent, true),
        f.usd(cap.capCost),
        cap.windows,
      )
    : t.limits.noCap;

  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-[var(--ink-secondary)]">{title}</p>
        <p className="tabular text-[26px] font-semibold leading-tight text-[var(--ink)]">
          {f.percent(used)}
        </p>
      </div>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--ramp-1)" }}
        role="meter"
        aria-valuenow={Math.round(used * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t.limits.meterLabel(title)}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${used > 0 ? Math.max(1, used * 100) : 0}%`, background: tone(used) }}
        />
      </div>
      <p className="mt-1.5 text-[12px] text-[var(--ink-muted)]">{resetText(kind, analysis, now, t, f)}</p>

      <PaceChart analysis={analysis} now={now} />

      <div className="mt-3 space-y-1 text-[12px]">
        {pace && (
          <p
            className={pace.alarming ? "font-medium" : "text-[var(--ink-secondary)]"}
            style={pace.alarming ? { color: "var(--status-critical)" } : undefined}
          >
            {pace.text}
          </p>
        )}
        <p className="text-[var(--ink-muted)]">{capText}</p>
      </div>
    </div>
  );
}

/**
 * Jauges des limites d'usage Claude : fenêtre de 5 heures et semaine.
 *
 * Contrairement au reste du tableau de bord, ces pourcentages ne se déduisent
 * pas des transcripts : ils viennent d'Anthropic, relayés par la statusline.
 * La projection et le plafond estimé, eux, croisent ces relevés avec les
 * transcripts.
 */
export function UsageLimits({ limits, now }: { limits: LimitsReport | null; now: number }) {
  const { t, f } = useI18n();

  if (!limits) {
    return (
      <Card title={t.limits.title}>
        <div className="text-[13px] leading-relaxed text-[var(--ink-secondary)]">
          {t.limits.setup}
          <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-sunken)] p-3 text-[12px]">
            npm run setup:statusline
          </pre>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t.limits.title} subtitle={t.limits.subtitle}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Gauge kind="session" analysis={limits.session} now={now} />
        <Gauge kind="week" analysis={limits.week} now={now} />
      </div>
      <p className="mt-2 text-right text-[12px] text-[var(--ink-muted)]">
        {t.limits.lastReading(f.timeAgo(limits.capturedAt, now), f.integer(limits.historySize))}
      </p>
    </Card>
  );
}
