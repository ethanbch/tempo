"use client";

import { useEffect, useRef, useState } from "react";

import type { RangeKey, UsageReport } from "@/lib/aggregate";
import { LOCALES, LOCALE_NAMES, isLocale } from "@/lib/i18n";
import { UNSPECIFIED_EFFORT } from "@/lib/insights";
import { modelLabel } from "@/lib/pricing";
import { modelSlot } from "@/lib/series";
import type { LimitsReport } from "@/lib/limits";
import type { Account } from "@/lib/types";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import { RankedBars } from "@/components/charts/RankedBars";
import { StackedCost } from "@/components/charts/StackedCost";
import { useI18n } from "@/components/I18nProvider";
import { Levers } from "@/components/Levers";
import { QuotaWindows } from "@/components/QuotaWindows";
import { SessionDetail } from "@/components/SessionDetail";
import { UsageLimits } from "@/components/UsageLimits";
import { UsageTable } from "@/components/UsageTable";
import { Card, ORDINAL_VARS, SERIES_VARS, StatTile } from "@/components/ui";

/** Échelle d'effort, du plus léger au plus soutenu : c'est un ordre, pas une liste. */
const EFFORT_SCALE = ["low", "medium", "high", "xhigh", "max"];

/** Cadence du rafraîchissement de fond, quand l'onglet est visible. */
const REFRESH_INTERVAL_MS = 30_000;

const RANGES: RangeKey[] = ["24h", "7d", "30d", "all"];

export function Dashboard({
  initialReport,
  initialLimits,
  account,
}: {
  initialReport: UsageReport;
  initialLimits: LimitsReport | null;
  account: Account;
}) {
  const { t, f } = useI18n();
  const { compactTokens, duration, integer, percent, timeAgo, usd } = f;
  const [report, setReport] = useState(initialReport);
  const [limits, setLimits] = useState(initialLimits);
  const [range, setRange] = useState<RangeKey>(initialReport.range);
  const [projectId, setProjectId] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  /** Horodatage du dernier appel terminé, qui borne la cadence réelle. */
  const lastFetchedAt = useRef<number>(Date.parse(initialReport.meta.generatedAt));

  // Les durées relatives se lisent par rapport à l'instant où le serveur a
  // calculé ce rapport, pas à l'horloge du navigateur : les deux peuvent
  // diverger, et c'est la mesure du serveur qui fait foi.
  const now = Date.parse(report.meta.generatedAt);

  function queryString(nextRange: RangeKey, nextProjectId: string, nextModel: string) {
    const params = new URLSearchParams({ range: nextRange });
    if (nextProjectId) params.set("project", nextProjectId);
    if (nextModel) params.set("model", nextModel);
    return params.toString();
  }

  /** Recharge avec la période et les filtres donnés, en annulant une requête encore en vol. */
  async function reload(nextRange: RangeKey, nextProjectId: string, nextModel: string) {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setRange(nextRange);
    setProjectId(nextProjectId);
    setModel(nextModel);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/usage?${queryString(nextRange, nextProjectId, nextModel)}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(t.common.httpStatus(response.status));
      const payload = (await response.json()) as { report: UsageReport; limits: LimitsReport | null };
      setReport(payload.report);
      setLimits(payload.limits);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : t.common.unknownError);
    } finally {
      lastFetchedAt.current = Date.now();
      if (inFlight.current === controller) inFlight.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  /*
   * Rafraîchissement périodique.
   *
   * Trois garde-fous le rendent négligeable en arrière-plan : rien n'est demandé
   * tant que l'onglet n'est pas visible, jamais deux requêtes ne se chevauchent,
   * et l'erreur est silencieuse — un rafraîchissement de fond n'a pas à alarmer
   * l'utilisateur ni à effacer ce qu'il regarde. Côté serveur, l'empreinte du
   * disque fait qu'un appel sans nouveauté ne coûte qu'un `stat` par fichier.
   */
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (document.visibilityState !== "visible") return;
      if (inFlight.current) return;

      const controller = new AbortController();
      inFlight.current = controller;
      try {
        const response = await fetch(`/api/usage?${queryString(range, projectId, model)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          report: UsageReport;
          limits: LimitsReport | null;
        };
        if (!cancelled) {
          setReport(payload.report);
          setLimits(payload.limits);
        }
      } catch {
        // Silencieux : le rendu précédent reste à l'écran.
      } finally {
        lastFetchedAt.current = Date.now();
        if (inFlight.current === controller) inFlight.current = null;
      }
    }

    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);

    // Au retour sur l'onglet on rattrape le temps passé masqué — mais seulement
    // si les données ont réellement vieilli. Sans cette borne, quelqu'un qui
    // alterne entre deux onglets déclencherait une rafale de requêtes.
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchedAt.current < REFRESH_INTERVAL_MS) return;
      void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [range, projectId, model]);

  const { summary } = report;
  const models = report.byModel.map((model) => ({
    key: model.model,
    label: model.label,
    value: model.cost,
    color: SERIES_VARS[modelSlot(model.model, report.allModels)],
    caption: t.captions.requests(integer(model.requests)),
    detail: [
      { label: t.common.cost, value: usd(model.cost) },
      { label: t.common.requests, value: integer(model.requests) },
      { label: t.common.output, value: compactTokens(model.outputTokens) },
      { label: t.common.cacheRead, value: compactTokens(model.cacheReadTokens) },
    ],
  }));

  const cacheCauses = report.insights.cacheRebuilds
    .filter((entry) => entry.cost > 0)
    .map((entry) => ({
      key: entry.cause,
      label: t.causes[entry.cause],
      value: entry.cost,
      // Série nominale : la longueur porte la grandeur, une seule teinte suffit.
      color: SERIES_VARS[0],
      caption: t.captions.requestsTokens(integer(entry.requests), compactTokens(entry.tokens)),
      detail: [
        { label: t.common.cost, value: usd(entry.cost) },
        { label: t.common.requests, value: integer(entry.requests) },
        { label: t.captions.contextRewritten, value: compactTokens(entry.tokens) },
      ],
    }));

  const efforts = [...report.insights.byEffort]
    .sort((a, b) => {
      const rank = (effort: string) => {
        const index = EFFORT_SCALE.indexOf(effort);
        return index === -1 ? EFFORT_SCALE.length : index;
      };
      return rank(a.effort) - rank(b.effort);
    })
    .map((slice) => {
      const position = EFFORT_SCALE.indexOf(slice.effort);
      return {
        key: slice.effort,
        label: slice.effort === UNSPECIFIED_EFFORT ? t.effortUnspecified : slice.effort,
        value: slice.cost,
        // Échelle ordonnée : une seule teinte, du clair au foncé selon le niveau.
        color:
          ORDINAL_VARS[
            position === -1
              ? 0
              : Math.min(ORDINAL_VARS.length - 1, Math.floor((position / (EFFORT_SCALE.length - 1)) * (ORDINAL_VARS.length - 1)))
          ],
        caption: t.captions.requestsReasoning(integer(slice.requests), percent(slice.thinkingShare)),
        detail: [
          { label: t.common.cost, value: usd(slice.cost) },
          { label: t.common.requests, value: integer(slice.requests) },
          { label: t.common.output, value: compactTokens(slice.outputTokens) },
          { label: t.common.reasoning, value: compactTokens(slice.thinkingTokens) },
        ],
      };
    });

  const projects = report.byProject.slice(0, 8).map((project) => ({
    key: project.projectId,
    label: project.name,
    value: project.cost,
    // Série nominale : une seule teinte, la longueur porte déjà la grandeur.
    color: SERIES_VARS[0],
    caption: t.captions.sessionsRequests(
      integer(project.sessions),
      integer(project.requests),
      project.sessions,
    ),
    detail: [
      { label: t.common.cost, value: usd(project.cost) },
      { label: t.common.requests, value: integer(project.requests) },
      { label: t.common.sessions, value: integer(project.sessions) },
      { label: t.common.lastActivity, value: timeAgo(project.lastActivity, now) },
    ],
  }));

  const sessions = report.bySession.slice(0, 8).map((session) => ({
    key: session.sessionId,
    label: session.projectName,
    value: session.cost,
    // Série nominale : une seule teinte, la longueur porte déjà la grandeur.
    color: SERIES_VARS[0],
    caption: t.captions.requestsDuration(integer(session.requests), duration(session.durationMs)),
    detail: [
      { label: t.common.cost, value: usd(session.cost) },
      { label: t.common.requests, value: integer(session.requests) },
      { label: t.common.duration, value: duration(session.durationMs) },
      { label: t.common.lastActivity, value: timeAgo(session.lastActivity, now) },
    ],
  }));

  return (
    <div className="mx-auto w-full max-w-[1140px] px-5 py-8 sm:px-8">
      <Header account={account} report={report} />

      {/* Les filtres tiennent sur une ligne, au-dessus de tout ce qu'ils cadrent. */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={t.filters.period}
            className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
          >
            {RANGES.map((option) => {
              const selected = option === range;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => void reload(option, projectId, model)}
                  className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                    selected
                      ? "bg-[var(--accent)] font-medium text-white"
                      : "text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {t.filters.ranges[option]}
                </button>
              );
            })}
          </div>

          <select
            aria-label={t.filters.byProject}
            value={projectId}
            onChange={(event) => void reload(range, event.target.value, model)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-secondary)]"
          >
            <option value="">{t.filters.allProjects}</option>
            {report.allProjects.map((project) => (
              <option key={project.projectId} value={project.projectId}>
                {project.name}
              </option>
            ))}
          </select>

          <select
            aria-label={t.filters.byModel}
            value={model}
            onChange={(event) => void reload(range, projectId, event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-secondary)]"
          >
            <option value="">{t.filters.allModels}</option>
            {report.allModels.map((id) => (
              <option key={id} value={id}>
                {modelLabel(id)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-pressed={showTable}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          {showTable ? t.filters.hideTable : t.filters.showTable}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px]"
          style={{ color: "var(--status-critical)" }}
        >
          {t.filters.reloadFailed(error)}
        </p>
      )}

      {/* Pendant un rechargement, le rendu précédent tient le cadre. */}
      <div
        className={`transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}
        aria-busy={loading}
      >
        <div className="mt-4">
          <UsageLimits limits={limits} now={now} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={t.stats.cost}
            value={usd(summary.cost)}
            hint={account.plan ? t.stats.costHintPlan(account.plan) : t.stats.costHint}
            emphasis
          />
          <StatTile
            label={t.common.requests}
            value={integer(summary.requests)}
            hint={t.stats.requestsHint(integer(summary.prompts), integer(summary.sessions), summary.sessions)}
          />
          <StatTile
            label={t.stats.tokens}
            value={compactTokens(summary.totalTokens)}
            hint={t.stats.tokensHint(
              compactTokens(summary.outputTokens),
              compactTokens(summary.thinkingTokens),
            )}
          />
          <StatTile
            label={t.stats.cache}
            value={percent(summary.cacheHitRate, 1)}
            hint={t.stats.cacheHint(compactTokens(summary.cacheReadTokens))}
          />
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Card title={t.cards.daily.title} subtitle={t.cards.daily.subtitle}>
            <StackedCost data={report.daily} />
          </Card>

          <Card title={t.cards.quota.title} subtitle={t.cards.quota.subtitle}>
            <QuotaWindows blocks={report.blocks} now={now} />
          </Card>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
          <Card title={t.cards.byModel.title} subtitle={t.cards.byModel.subtitle}>
            <RankedBars items={models} formatValue={(value) => usd(value)} />
          </Card>

          <Card title={t.cards.byProject.title} subtitle={t.cards.byProject.subtitle}>
            <RankedBars items={projects} formatValue={(value) => usd(value)} />
          </Card>
        </div>

        <div className="mt-4">
          <Card title={t.cards.sessions.title} subtitle={t.cards.sessions.subtitle}>
            <RankedBars
              items={sessions}
              formatValue={(value) => usd(value)}
              onSelect={setSelectedSessionId}
            />
          </Card>
        </div>

        <div className="mt-4">
          <Card title={t.cards.heatmap.title} subtitle={t.cards.heatmap.subtitle}>
            <ActivityHeatmap cells={report.heatmap} />
          </Card>
        </div>

        <div className="mt-4">
          <Card title={t.cards.levers.title} subtitle={t.cards.levers.subtitle}>
            <Levers levers={report.insights.levers} />
          </Card>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
          <Card title={t.cards.cacheCauses.title} subtitle={t.cards.cacheCauses.subtitle}>
            <RankedBars
              items={cacheCauses}
              formatValue={(value) => usd(value)}
              labelWidth={172}
              emptyMessage={t.cards.cacheCauses.empty}
            />
          </Card>

          <Card title={t.cards.effort.title} subtitle={t.cards.effort.subtitle}>
            <RankedBars
              items={efforts}
              formatValue={(value) => usd(value)}
              labelWidth={172}
              emptyMessage={t.cards.effort.empty}
            />
          </Card>
        </div>

        {showTable && (
          <div className="mt-4">
            <Card title={t.cards.table.title} subtitle={t.cards.table.subtitle}>
              <UsageTable daily={report.daily} />
            </Card>
          </div>
        )}

        <Footnotes report={report} />
      </div>

      {selectedSessionId && (
        <SessionDetail
          key={selectedSessionId}
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}

/** Cycle : suit le système → clair → sombre → suit le système. */
function nextTheme(current: "light" | "dark" | null): "light" | "dark" | null {
  if (current === null) return "light";
  if (current === "light") return "dark";
  return null;
}

function ThemeToggle() {
  // `null` (thème système) au premier rendu, des deux côtés : la préférence
  // stockée n'est lue qu'au montage, pour ne jamais désaccorder le HTML
  // serveur de la première passe client.
  const { t } = useI18n();
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    // localStorage n'est lisible que côté client, après le montage : pas
    // d'alternative synchrone compatible avec le rendu serveur ici.
    const stored = window.localStorage.getItem("tempo-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function toggle() {
    const next = nextTheme(theme);
    setTheme(next);
    if (next === null) {
      document.documentElement.removeAttribute("data-theme");
      window.localStorage.removeItem("tempo-theme");
    } else {
      document.documentElement.dataset.theme = next;
      window.localStorage.setItem("tempo-theme", next);
    }
  }

  const label = theme === "light" ? t.theme.light : theme === "dark" ? t.theme.dark : t.theme.system;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.theme.change(label)}
      title={label}
      // La préférence stockée n'existe que côté client : l'icône du premier
      // rendu serveur (thème système) peut différer de celle rendue au montage.
      suppressHydrationWarning
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
    >
      {theme === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 20h8M12 17v3" />
        </svg>
      )}
    </button>
  );
}

/** Sélecteur de langue, appliqué sur place et mémorisé dans un cookie. */
function LanguagePicker() {
  const { t, locale, setLocale } = useI18n();
  return (
    <select
      aria-label={t.header.language}
      title={t.header.language}
      value={locale}
      onChange={(event) => {
        if (isLocale(event.target.value)) setLocale(event.target.value);
      }}
      className="h-9 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
    >
      {LOCALES.map((option) => (
        // Le code suffit à l'œil ; le nom complet reste accessible au survol et
        // aux lecteurs d'écran.
        <option key={option} value={option} title={LOCALE_NAMES[option]} aria-label={LOCALE_NAMES[option]}>
          {option.toUpperCase()}
        </option>
      ))}
    </select>
  );
}

function Header({ account, report }: { account: Account; report: UsageReport }) {
  const { t, f } = useI18n();
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
            style={{ background: "var(--accent)" }}
          >
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M7 20.5H11.2L13.8 11L18.2 23L20.8 14.5H25"
                stroke="#faf9f5"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1
            className="text-[23px] font-semibold lowercase text-[var(--ink)]"
            style={{ letterSpacing: "-0.02em" }}
          >
            tempo
          </h1>
        </div>
        <p className="mt-1.5 text-[13px] text-[var(--ink-secondary)]">
          {t.header.tagline}
        </p>
      </div>

      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-right">
          {account.missing ? (
            <p className="text-[13px] text-[var(--ink-secondary)]">{t.header.noAccount}</p>
          ) : (
            <>
              <p className="text-[13px] font-medium text-[var(--ink)]">{account.email}</p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                {account.plan ? t.header.plan(account.plan) : t.header.account}
                {report.summary.lastActivity
                  ? ` · ${t.header.active(
                      f.timeAgo(report.summary.lastActivity, Date.parse(report.meta.scannedAt)),
                    )}`
                  : ""}
              </p>
            </>
          )}
        </div>
        <LanguagePicker />
        <ThemeToggle />
      </div>
    </header>
  );
}

function Footnotes({ report }: { report: UsageReport }) {
  const { t, f } = useI18n();
  const { reconciliation, meta, summary } = report;

  return (
    <footer className="mt-8 space-y-3 border-t border-[var(--border)] pt-5 text-[12px] leading-relaxed text-[var(--ink-muted)]">
      <p>
        <strong className="font-medium text-[var(--ink-secondary)]">{t.footer.readTitle}</strong>{" "}
        {t.footer.read}
      </p>
      <p>
        <strong className="font-medium text-[var(--ink-secondary)]">{t.footer.computeTitle}</strong>{" "}
        {t.footer.compute(
          f.usd(reconciliation.rawCost),
          f.usd(reconciliation.untrackedCost),
          f.percent(reconciliation.calibratedShare, 1),
        )}
        {reconciliation.uncalibratedSessions > 0
          ? t.footer.uncalibrated(f.integer(reconciliation.uncalibratedSessions))
          : ""}
        {reconciliation.hasUnknownModelCost ? t.footer.unknownModel : ""}
      </p>
      <p>
        {t.footer.files(f.integer(meta.fileCount), f.bytes(meta.byteCount))}{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5">{meta.root}</code>
        {meta.skippedLines > 0 ? t.footer.skipped(f.integer(meta.skippedLines)) : ""}
        {summary.firstActivity ? t.footer.since(f.formatDateTime(summary.firstActivity)) : ""}
        {t.footer.scanned(f.formatDateTime(meta.scannedAt))}
        {summary.activeDays > 0 ? t.footer.activeDays(f.integer(summary.activeDays)) : ""}
      </p>
      <p>{t.footer.privacy(f.duration(5 * 60 * 60 * 1000))}</p>
    </footer>
  );
}
