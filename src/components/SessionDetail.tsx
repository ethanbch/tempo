"use client";

import { useEffect, useState } from "react";

import type { RebuildCause } from "@/lib/insights";
import { useI18n } from "@/components/I18nProvider";

interface SessionRequest {
  time: string;
  model: string;
  label: string;
  effort: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  cacheCause: RebuildCause | null;
}

interface SessionData {
  sessionId: string;
  projectId: string;
  projectName: string;
  gitBranch: string | null;
  firstActivity: string;
  lastActivity: string;
  durationMs: number;
  cost: number;
  requests: SessionRequest[];
}

/**
 * Panneau de détail d'une session : en-tête récapitulatif puis timeline des
 * requêtes, chacune annotée de sa cause de réécriture de cache le cas échéant.
 *
 * Chargé à la demande via `/api/session` plutôt qu'embarqué dans le rapport
 * principal, pour garder ce dernier léger.
 */
export function SessionDetail({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { t, f } = useI18n();
  const { compactTokens, duration, formatDateTime, usd } = f;
  const [data, setData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/session?id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(t.common.httpStatus(response.status));
        setData(payload.session as SessionData);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t.common.unknownError);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, t]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.session.title}
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">{t.session.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.session.close}
            className="rounded-lg px-2 py-1 text-[13px] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
          >
            {t.session.close}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[13px]" style={{ color: "var(--status-critical)" }}>
            {t.session.loadFailed(error)}
          </p>
        )}

        {!data && !error && (
          <p className="mt-4 text-[13px] text-[var(--ink-secondary)]">{t.session.loading}</p>
        )}

        {data && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t.common.project} value={data.projectName} />
              <Stat label={t.session.branch} value={data.gitBranch && data.gitBranch !== "HEAD" ? data.gitBranch : "—"} />
              <Stat label={t.common.cost} value={usd(data.cost)} />
              <Stat label={t.common.duration} value={duration(data.durationMs)} />
              <Stat label={t.common.requests} value={f.integer(data.requests.length)} />
              <Stat label={t.session.peakContext} value={compactTokens(peakContext(data.requests))} />
              <Stat label={t.session.rewrites} value={f.integer(rewrites(data.requests).length)} />
            </div>

            <ContextChart requests={data.requests} />

            <ul className="mt-5 space-y-2">
              {data.requests.map((request, index) => (
                <li
                  key={`${request.time}-${index}`}
                  className="rounded-xl border border-[var(--border)] px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-[13px] font-medium text-[var(--ink)]">
                      {request.label}
                      {request.effort ? ` · ${t.session.effort(request.effort)}` : ""}
                    </span>
                    <span className="tabular text-[13px] font-semibold text-[var(--ink)]">
                      {usd(request.cost)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                    {formatDateTime(request.time)} · {t.session.output(compactTokens(request.outputTokens))}{" "}
                    · {t.session.reread(compactTokens(request.cacheReadTokens))}
                    {request.cacheCause
                      ? ` · ${t.session.cacheRewritten(t.causes[request.cacheCause])}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** Contexte envoyé par une requête : ce qui est relu, réécrit ou nouveau. */
function contextOf(request: SessionRequest): number {
  return request.inputTokens + request.cacheReadTokens + request.cacheWriteTokens;
}

function peakContext(requests: SessionRequest[]): number {
  return requests.reduce((max, request) => Math.max(max, contextOf(request)), 0);
}

/** Les réécritures évitables : après une pause, un changement de modèle ou d'effort. */
function rewrites(requests: SessionRequest[]): number[] {
  return requests.flatMap((request, index) =>
    request.cacheCause && request.cacheCause !== "context-growth" && request.cacheCause !== "session-start"
      ? [index]
      : [],
  );
}

/**
 * Le contexte requête après requête : il croît à chaque tour et retombe après
 * une compaction. Les points jaunes marquent les réécritures évitables.
 */
function ContextChart({ requests }: { requests: SessionRequest[] }) {
  const { t } = useI18n();
  if (requests.length < 2) return null;

  const peak = peakContext(requests) || 1;
  const x = (index: number) => (index / (requests.length - 1)) * 1000;
  const y = (value: number) => 100 - (value / peak) * 92;
  const line = requests.map((request, index) => `${index ? "L" : "M"}${x(index)} ${y(contextOf(request))}`).join(" ");
  const area = `${line} L1000 100 L0 100 Z`;

  return (
    <div className="mt-4">
      <p className="eyebrow">{t.session.contextTitle}</p>
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="mt-2 block h-20 w-full" aria-hidden>
        <path d={area} fill="var(--accent)" opacity={0.12} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {rewrites(requests).map((index) => (
          <line
            key={index}
            x1={x(index)}
            x2={x(index)}
            y1={y(contextOf(requests[index]))}
            y2={100}
            stroke="var(--status-warning)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {rewrites(requests).length > 0 && (
        <p className="mt-1 text-[12px] text-[var(--ink-muted)]">{t.session.contextLegend}</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--ink-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--ink)]">{value}</p>
    </div>
  );
}
