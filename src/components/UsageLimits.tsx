"use client";

import type { LimitAnalysis, LimitKind, LimitsReport } from "@/lib/limits";
import { duration, formatDateTime, formatTime, integer, percent, timeAgo, usd } from "@/lib/format";
import { Card } from "@/components/ui";

/** Seuils à partir desquels la jauge change de ton. */
const WARNING_AT = 0.7;
const CRITICAL_AT = 0.9;

const LABELS: Record<LimitKind, { title: string; window: string; windows: string; pace: string }> = {
  session: { title: "Session (5 heures)", window: "session", windows: "sessions", pace: "la dernière heure" },
  week: { title: "Semaine", window: "semaine", windows: "semaines", pace: "les dernières 24 h" },
};

function tone(used: number): string {
  if (used >= CRITICAL_AT) return "var(--status-critical)";
  if (used >= WARNING_AT) return "var(--status-warning)";
  return "var(--accent)";
}

/** Compte à rebours lisible : « 3 j 14 h », « 2 h 13 », « 37 min ». */
function countdown(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return duration(ms);
  return `${days} j ${Math.floor((ms % 86_400_000) / 3_600_000)} h`;
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

function resetText(kind: LimitKind, analysis: LimitAnalysis, now: number): string {
  if (analysis.expired) return "Réinitialisée depuis le dernier relevé";
  if (!analysis.resetsAt) return "Échéance inconnue";
  const remaining = Date.parse(analysis.resetsAt) - now;
  return kind === "session"
    ? `Réinitialisation à ${formatTime(analysis.resetsAt)} · dans ${countdown(remaining)}`
    : `Réinitialisation dans ${countdown(remaining)} · ${formatDateTime(analysis.resetsAt)}`;
}

function paceText(kind: LimitKind, analysis: LimitAnalysis): { text: string; alarming: boolean } | null {
  const { projection } = analysis;
  if (!projection) return null;
  if (projection.hitsAt) {
    const when =
      kind === "session" ? formatTime(projection.hitsAt) : formatDateTime(projection.hitsAt);
    return { text: `À ce rythme, limite atteinte vers ${when}`, alarming: true };
  }
  if (projection.ratePerHour === 0) {
    return { text: `Aucune consommation sur ${LABELS[kind].pace}`, alarming: false };
  }
  return {
    text: `À ce rythme, ≈ ${percent(projection.usedAtReset)} à la réinitialisation`,
    alarming: false,
  };
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
  const labels = LABELS[kind];
  if (!analysis) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] p-4">
        <p className="text-[13px] text-[var(--ink-secondary)]">{labels.title}</p>
        <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">Pas encore de relevé.</p>
      </div>
    );
  }

  const { used, cap } = analysis;
  const pace = paceText(kind, analysis);

  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-[var(--ink-secondary)]">{labels.title}</p>
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
        aria-label={`${labels.title} : part consommée`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${used > 0 ? Math.max(1, used * 100) : 0}%`, background: tone(used) }}
        />
      </div>
      <p className="mt-1.5 text-[12px] text-[var(--ink-muted)]">{resetText(kind, analysis, now)}</p>

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
        <p className="text-[var(--ink-muted)]">
          {cap
            ? `1 % ≈ ${usd(cap.costPerPercent, true)} · ${labels.window} complète ≈ ${usd(
                cap.capCost,
              )} en équivalent API, d'après ${integer(cap.windows)} ${
                cap.windows > 1 ? labels.windows : labels.window
              }`
            : "Plafond estimé : pas encore assez de données"}
        </p>
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
  if (!limits) {
    return (
      <Card title="Limites d'usage">
        <div className="text-[13px] leading-relaxed text-[var(--ink-secondary)]">
          Les jauges de session et de semaine s&apos;affichent une fois la statusline de Tempo
          installée. Depuis le dossier de Tempo :
          <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-sunken)] p-3 text-[12px]">
            npm run setup:statusline
          </pre>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Limites d'usage"
      subtitle="Relevées par la statusline Claude Code. Le plafond estimé rapporte le coût des requêtes Claude Code de cette machine au pourcentage consommé : l'usage sur claude.ai ou ailleurs compte aussi dans la limite, le plafond réel est alors plus haut."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Gauge kind="session" analysis={limits.session} now={now} />
        <Gauge kind="week" analysis={limits.week} now={now} />
      </div>
      <p className="mt-2 text-right text-[12px] text-[var(--ink-muted)]">
        Dernier relevé {timeAgo(limits.capturedAt, now)} · {integer(limits.historySize)} relevés en
        historique
      </p>
    </Card>
  );
}
