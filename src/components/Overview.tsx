"use client";

import type { RangeKey, UsageReport } from "@/lib/aggregate";
import type { Lever } from "@/lib/insights";
import type { LimitAnalysis, LimitKind, LimitsReport } from "@/lib/limits";
import type { TabKey } from "@/lib/tabs";
import { StackedCost } from "@/components/charts/StackedCost";
import { useI18n } from "@/components/I18nProvider";
import { paceText, resetText, tone } from "@/components/UsageLimits";
import { Card, SegmentedMeter } from "@/components/ui";


/**
 * Vue d'ensemble : ce qu'on regarde tous les jours, sur un seul écran. Les
 * limites d'abord, puis le coût et sa courbe, enfin ce qu'il y a à optimiser.
 * Chaque bloc renvoie vers l'onglet qui le détaille.
 */
export function Overview({
  report,
  limits,
  now,
  range,
  account,
  onNavigate,
}: {
  report: UsageReport;
  limits: LimitsReport | null;
  now: number;
  range: RangeKey;
  account: { plan: string | null };
  onNavigate: (tab: TabKey) => void;
}) {
  const { t, f } = useI18n();
  const { summary } = report;

  return (
    <div className="grid gap-4">
      <Card
        title={t.limits.title}
        info={t.limits.subtitle}
        action={<GoLink label={t.overview.limitsDetail} onClick={() => onNavigate("activity")} />}
      >
        {limits ? (
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
            <LimitSummary kind="session" analysis={limits.session} now={now} />
            <LimitSummary kind="week" analysis={limits.week} now={now} />
          </div>
        ) : (
          <div className="text-[13px] leading-relaxed text-[var(--ink-secondary)]">
            {t.limits.setup}{" "}
            <code className="mono rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[12px] text-[var(--ink)]">
              npm run setup:statusline
            </code>
          </div>
        )}
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_1.55fr]">
        <section className="flex min-w-0 flex-col justify-between gap-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div>
            <h2 className="eyebrow">{t.overview.costLabel(t.filters.ranges[range].toLocaleLowerCase())}</h2>
            <p className="mt-3 text-[46px] font-semibold leading-none tracking-[-0.03em] text-[var(--ink)]">
              {f.usd(summary.cost)}
            </p>
            <p className="mt-2.5 text-[13px] text-[var(--ink-secondary)]">
              {account.plan ? t.stats.costHintPlan(account.plan) : t.stats.costHint}
            </p>
            <CostFacts report={report} />
          </div>
          <dl className="grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-4">
            <Kpi label={t.common.requests} value={f.integer(summary.requests)} />
            <Kpi label={t.stats.tokens} value={f.compactTokens(summary.totalTokens)} />
            <Kpi label={t.stats.cache} value={f.percent(summary.cacheHitRate, 1)} />
          </dl>
        </section>

        <Card title={t.cards.daily.title} info={t.cards.daily.subtitle}>
          <StackedCost data={report.daily} />
        </Card>
      </div>

      <LeversTeaser levers={report.insights.levers} onOpen={() => onNavigate("optimize")} />
    </div>
  );
}

/**
 * Ce qui situe le chiffre : l'écart avec la période précédente, la dépense
 * d'une journée type et le jour le plus lourd. L'écart reste neutre en
 * couleur : dépenser plus n'est ni bien ni mal en soi.
 */
function CostFacts({ report }: { report: UsageReport }) {
  const { t, f } = useI18n();
  const { summary, daily } = report;
  const peak = daily.reduce<(typeof daily)[number] | null>(
    (best, point) => (point.cost > (best?.cost ?? 0) ? point : best),
    null,
  );

  let comparison: string | null = null;
  if (summary.previousCost !== null) {
    if (summary.previousCost > 0) {
      const delta = (summary.cost - summary.previousCost) / summary.previousCost;
      comparison = `${delta >= 0 ? "▲ +" : "▼ −"}${f.percent(Math.abs(delta))} ${t.overview.vsPrevious}`;
    } else if (summary.cost > 0) {
      comparison = t.overview.noPrevious;
    }
  }

  return (
    <dl className="mt-5 grid gap-2 text-[13px]">
      {comparison && (
        <div className="mono text-[12.5px] text-[var(--ink-secondary)]">{comparison}</div>
      )}
      {summary.activeDays > 0 && (
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--ink-muted)]">{t.overview.avgPerDay}</dt>
          <dd className="mono text-[var(--ink)]">{f.usd(summary.cost / summary.activeDays)}</dd>
        </div>
      )}
      {peak && (
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--ink-muted)]">{t.overview.peakDay}</dt>
          <dd className="mono text-[var(--ink)]">
            {f.formatDay(peak.date)} · {f.usd(peak.cost)}
          </dd>
        </div>
      )}
    </dl>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[12px] text-[var(--ink-muted)]">{label}</dt>
      <dd className="mono mt-1 truncate text-[16px] font-medium text-[var(--ink)]">{value}</dd>
    </div>
  );
}

/** Une limite résumée : le pourcentage, la jauge, l'échéance et le rythme. */
function LimitSummary({
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
      <div>
        <p className="text-[13px] text-[var(--ink-secondary)]">{title}</p>
        <p className="mt-2 text-[13px] text-[var(--ink-muted)]">{t.limits.noReading}</p>
      </div>
    );
  }

  const pace = paceText(kind, analysis, t, f);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-[var(--ink-secondary)]">{title}</p>
        <p className="mono text-[26px] font-medium leading-none text-[var(--ink)]">
          {f.percent(analysis.used)}
        </p>
      </div>
      <div className="mt-3">
        <SegmentedMeter
          value={analysis.used}
          color={tone(analysis.used)}
          label={t.limits.meterLabel(title)}
        />
      </div>
      <div className="mono mt-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11.5px] text-[var(--ink-secondary)]">
        <span>{resetText(kind, analysis, now, t, f)}</span>
        {pace && (
          <span style={pace.alarming ? { color: "var(--status-warning)" } : undefined}>{pace.text}</span>
        )}
      </div>
    </div>
  );
}

/** Ce qu'il y a à gagner, en une ligne, avec l'accès au détail. */
function LeversTeaser({ levers, onOpen }: { levers: Lever[]; onOpen: () => void }) {
  const { t, f } = useI18n();
  const free = levers.filter((lever) => lever.kind === "free");
  const freeTotal = free.reduce((sum, lever) => sum + lever.amount, 0);

  const text =
    free.length > 0
      ? t.overview.teaser(free.length, f.usd(freeTotal))
      : levers.length > 0
        ? t.overview.teaserTradeoffs(levers.length)
        : t.overview.nothing;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-left transition-colors hover:bg-[var(--surface-hover)]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="mono shrink-0 rounded-md px-2 py-0.5 text-[12px] font-medium"
          style={{ background: "var(--accent-wash)", color: "var(--accent)" }}
        >
          {free.length > 0 ? free.length : levers.length}
        </span>
        <span className="truncate text-[14px] text-[var(--ink)]">{text}</span>
      </span>
      <span className="shrink-0 text-[13px] font-medium text-[var(--accent)]">
        {t.overview.see} <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </button>
  );
}

/** Lien discret vers un autre onglet, en tête de carte. */
export function GoLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md px-1.5 py-0.5 text-[12.5px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent-wash)]"
    >
      {label} →
    </button>
  );
}
