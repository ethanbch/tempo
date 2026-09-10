"use client";

import { useEffect, useRef, useState } from "react";

import type { RangeKey, UsageReport } from "@/lib/aggregate";
import {
  bytes,
  compactTokens,
  duration,
  formatDateTime,
  integer,
  percent,
  timeAgo,
  usd,
} from "@/lib/format";
import { modelSlot } from "@/lib/series";
import type { Account } from "@/lib/types";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import { RankedBars } from "@/components/charts/RankedBars";
import { StackedCost } from "@/components/charts/StackedCost";
import { Levers } from "@/components/Levers";
import { QuotaWindows } from "@/components/QuotaWindows";
import { UsageTable } from "@/components/UsageTable";
import { Card, ORDINAL_VARS, SERIES_VARS, StatTile } from "@/components/ui";

/** Échelle d'effort, du plus léger au plus soutenu : c'est un ordre, pas une liste. */
const EFFORT_SCALE = ["low", "medium", "high", "xhigh", "max"];

/** Cadence du rafraîchissement de fond, quand l'onglet est visible. */
const REFRESH_INTERVAL_MS = 30_000;

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "24h", label: "24 heures" },
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
  { key: "all", label: "Tout" },
];

export function Dashboard({
  initialReport,
  account,
}: {
  initialReport: UsageReport;
  account: Account;
}) {
  const [report, setReport] = useState(initialReport);
  const [range, setRange] = useState<RangeKey>(initialReport.range);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  /** Horodatage du dernier appel terminé, qui borne la cadence réelle. */
  const lastFetchedAt = useRef<number>(Date.parse(initialReport.meta.generatedAt));

  // Les durées relatives se lisent par rapport à l'instant où le serveur a
  // calculé ce rapport, pas à l'horloge du navigateur : les deux peuvent
  // diverger, et c'est la mesure du serveur qui fait foi.
  const now = Date.parse(report.meta.generatedAt);

  /** Change de période et recharge, en annulant une requête encore en vol. */
  async function selectRange(next: RangeKey) {
    if (next === range) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setRange(next);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/usage?range=${next}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`réponse ${response.status}`);
      const payload = (await response.json()) as { report: UsageReport };
      setReport(payload.report);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "erreur inconnue");
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
        const response = await fetch(`/api/usage?range=${range}`, { signal: controller.signal });
        if (!response.ok) return;
        const payload = (await response.json()) as { report: UsageReport };
        if (!cancelled) setReport(payload.report);
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
  }, [range]);

  const { summary } = report;
  const models = report.byModel.map((model) => ({
    key: model.model,
    label: model.label,
    value: model.cost,
    color: SERIES_VARS[modelSlot(model.model, report.allModels)],
    caption: `${integer(model.requests)} requêtes`,
    detail: [
      { label: "Coût", value: usd(model.cost) },
      { label: "Requêtes", value: integer(model.requests) },
      { label: "Sortie", value: compactTokens(model.outputTokens) },
      { label: "Lecture cache", value: compactTokens(model.cacheReadTokens) },
    ],
  }));

  const cacheCauses = report.insights.cacheRebuilds
    .filter((entry) => entry.cost > 0)
    .map((entry) => ({
      key: entry.cause,
      label: entry.label,
      value: entry.cost,
      // Série nominale : la longueur porte la grandeur, une seule teinte suffit.
      color: SERIES_VARS[0],
      caption: `${integer(entry.requests)} req · ${compactTokens(entry.tokens)} tokens`,
      detail: [
        { label: "Coût", value: usd(entry.cost) },
        { label: "Requêtes", value: integer(entry.requests) },
        { label: "Contexte réécrit", value: compactTokens(entry.tokens) },
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
        label: slice.effort,
        value: slice.cost,
        // Échelle ordonnée : une seule teinte, du clair au foncé selon le niveau.
        color:
          ORDINAL_VARS[
            position === -1
              ? 0
              : Math.min(ORDINAL_VARS.length - 1, Math.floor((position / (EFFORT_SCALE.length - 1)) * (ORDINAL_VARS.length - 1)))
          ],
        caption: `${integer(slice.requests)} req · ${percent(slice.thinkingShare)} raisonnement`,
        detail: [
          { label: "Coût", value: usd(slice.cost) },
          { label: "Requêtes", value: integer(slice.requests) },
          { label: "Sortie", value: compactTokens(slice.outputTokens) },
          { label: "Raisonnement", value: compactTokens(slice.thinkingTokens) },
        ],
      };
    });

  const projects = report.byProject.slice(0, 8).map((project) => ({
    key: project.projectId,
    label: project.name,
    value: project.cost,
    // Série nominale : une seule teinte, la longueur porte déjà la grandeur.
    color: SERIES_VARS[0],
    caption: `${integer(project.sessions)} sessions · ${integer(project.requests)} req`,
    detail: [
      { label: "Coût", value: usd(project.cost) },
      { label: "Requêtes", value: integer(project.requests) },
      { label: "Sessions", value: integer(project.sessions) },
      { label: "Dernière activité", value: timeAgo(project.lastActivity, now) },
    ],
  }));

  return (
    <div className="mx-auto w-full max-w-[1140px] px-5 py-8 sm:px-8">
      <Header account={account} report={report} />

      {/* Les filtres tiennent sur une ligne, au-dessus de tout ce qu'ils cadrent. */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Période"
          className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
        >
          {RANGES.map((option) => {
            const selected = option.key === range;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={selected}
                onClick={() => void selectRange(option.key)}
                className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  selected
                    ? "bg-[var(--accent)] font-medium text-white"
                    : "text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-pressed={showTable}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          {showTable ? "Masquer le tableau" : "Voir le tableau"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px]"
          style={{ color: "var(--status-critical)" }}
        >
          Rechargement impossible : {error}
        </p>
      )}

      {/* Pendant un rechargement, le rendu précédent tient le cadre. */}
      <div
        className={`transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}
        aria-busy={loading}
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Coût équivalent API"
            value={usd(summary.cost)}
            hint={
              account.plan
                ? `ce que cet usage aurait coûté à l'API, hors abonnement ${account.plan}`
                : "ce que cet usage aurait coûté à l'API"
            }
            emphasis
          />
          <StatTile
            label="Requêtes"
            value={integer(summary.requests)}
            hint={`${integer(summary.prompts)} prompts · ${integer(summary.sessions)} sessions`}
          />
          <StatTile
            label="Tokens"
            value={compactTokens(summary.totalTokens)}
            hint={`${compactTokens(summary.outputTokens)} en sortie · ${compactTokens(
              summary.thinkingTokens,
            )} de raisonnement`}
          />
          <StatTile
            label="Servi par le cache"
            value={percent(summary.cacheHitRate, 1)}
            hint={`${compactTokens(summary.cacheReadTokens)} tokens relus`}
          />
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Card
            title="Coût par jour"
            subtitle="Ventilé par poste : entrée, écriture et lecture de cache, sortie."
          >
            <StackedCost data={report.daily} />
          </Card>

          <Card
            title="Fenêtres de 5 heures"
            subtitle="Le quota Claude se recharge par fenêtre glissante ouverte à la première requête."
          >
            <QuotaWindows blocks={report.blocks} now={now} />
          </Card>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
          <Card title="Par modèle" subtitle="Coût équivalent API sur la période.">
            <RankedBars items={models} formatValue={(value) => usd(value)} />
          </Card>

          <Card title="Par projet" subtitle="Les huit projets les plus coûteux.">
            <RankedBars items={projects} formatValue={(value) => usd(value)} />
          </Card>
        </div>

        <div className="mt-4">
          <Card
            title="Quand tu utilises Claude"
            subtitle="Requêtes par jour de la semaine et par heure, sur ton fuseau local."
          >
            <ActivityHeatmap cells={report.heatmap} />
          </Card>
        </div>

        <div className="mt-4">
          <Card
            title="Leviers d'optimisation"
            subtitle="Ce que tes propres requêtes révèlent, classé par ce qu'il y a à gagner."
          >
            <Levers levers={report.insights.levers} />
          </Card>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
          <Card
            title="Écritures de cache, par cause"
            subtitle="Réenregistrer du contexte se paie : voici ce qui l'a déclenché."
          >
            <RankedBars
              items={cacheCauses}
              formatValue={(value) => usd(value)}
              labelWidth={172}
              emptyMessage="Aucune écriture de cache sur cette période."
            />
          </Card>

          <Card
            title="Par niveau d'effort"
            subtitle="Dépense et part du raisonnement, du plus léger au plus soutenu."
          >
            <RankedBars
              items={efforts}
              formatValue={(value) => usd(value)}
              labelWidth={172}
              emptyMessage="Aucun niveau d'effort renseigné sur cette période."
            />
          </Card>
        </div>

        {showTable && (
          <div className="mt-4">
            <Card title="Détail par jour" subtitle="Toutes les valeurs des graphiques, en clair.">
              <UsageTable daily={report.daily} />
            </Card>
          </div>
        )}

        <Footnotes report={report} />
      </div>
    </div>
  );
}

function Header({ account, report }: { account: Account; report: UsageReport }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-lg text-[15px] font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            ✳
          </span>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ink)]">Tempo</h1>
        </div>
        <p className="mt-1.5 text-[13px] text-[var(--ink-secondary)]">
          Ton usage de Claude Code, lu depuis les transcripts de ta machine.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-right">
        {account.missing ? (
          <p className="text-[13px] text-[var(--ink-secondary)]">Aucun compte Claude détecté</p>
        ) : (
          <>
            <p className="text-[13px] font-medium text-[var(--ink)]">{account.email}</p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
              {account.plan ? `Claude ${account.plan}` : "Compte Claude"}
              {report.summary.lastActivity
                ? ` · actif ${timeAgo(report.summary.lastActivity, Date.parse(report.meta.scannedAt))}`
                : ""}
            </p>
          </>
        )}
      </div>
    </header>
  );
}

function Footnotes({ report }: { report: UsageReport }) {
  const { reconciliation, meta, summary } = report;

  return (
    <footer className="mt-8 space-y-3 border-t border-[var(--border)] pt-5 text-[12px] leading-relaxed text-[var(--ink-muted)]">
      <p>
        <strong className="font-medium text-[var(--ink-secondary)]">Comment lire le coût.</strong>{" "}
        Un abonnement Claude Pro ou Max n&apos;est pas facturé au token : le montant affiché est ce
        que le même usage aurait coûté à l&apos;API, tarifs publics à l&apos;appui. Il mesure la
        valeur consommée, pas une dépense réelle.
      </p>
      <p>
        <strong className="font-medium text-[var(--ink-secondary)]">Comment le coût est calculé.</strong>{" "}
        Les {usd(reconciliation.rawCost)} de requêtes visibles dans les transcripts sont calibrés
        session par session sur les relevés que Claude Code écrit en fin de session, ce qui ajoute{" "}
        {usd(reconciliation.untrackedCost)} d&apos;appels qu&apos;il ne journalise pas — génération
        de titres, compaction de contexte, tâches utilitaires. {percent(
          reconciliation.calibratedShare,
          1,
        )}{" "}
        du total affiché est ainsi calibré.
        {reconciliation.uncalibratedSessions > 0
          ? ` ${integer(reconciliation.uncalibratedSessions)} session(s) encore ouverte(s) n'ont pas
             de relevé : leur coût est un plancher, légèrement sous-estimé.`.replace(/\s+/g, " ")
          : ""}
        {reconciliation.hasUnknownModelCost
          ? " Une session au moins porte un modèle dont Claude Code ignore le tarif."
          : ""}
      </p>
      <p>
        {integer(meta.fileCount)} transcripts · {bytes(meta.byteCount)} lus depuis{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5">{meta.root}</code>
        {meta.skippedLines > 0 ? ` · ${integer(meta.skippedLines)} lignes illisibles ignorées` : ""}
        {summary.firstActivity
          ? ` · historique depuis le ${formatDateTime(summary.firstActivity)}`
          : ""}
        {` · scan du ${formatDateTime(meta.scannedAt)}`}
        {summary.activeDays > 0 ? ` · ${integer(summary.activeDays)} jours actifs` : ""}
      </p>
      <p>
        Aucune donnée ne quitte ta machine : l&apos;application lit les fichiers locaux et
        n&apos;appelle aucun service distant. Durée d&apos;une fenêtre de quota :{" "}
        {duration(5 * 60 * 60 * 1000)}.
      </p>
    </footer>
  );
}
