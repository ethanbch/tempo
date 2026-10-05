"use client";

import { useEffect, useState } from "react";

import { compactTokens, duration, formatDateTime, usd } from "@/lib/format";

const CAUSE_LABELS: Record<string, string> = {
  "session-start": "Ouverture de session",
  "context-growth": "Croissance du contexte",
  "idle-timeout": "Reprise après pause",
  "model-switch": "Changement de modèle",
  "effort-switch": "Changement d'effort",
};

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
  cacheCause: string | null;
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
  const [data, setData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/session?id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error ?? `réponse ${response.status}`);
        setData(payload.session as SessionData);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "erreur inconnue");
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Détail de la session"
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">Détail de la session</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg px-2 py-1 text-[13px] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
          >
            Fermer
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[13px]" style={{ color: "var(--status-critical)" }}>
            Chargement impossible : {error}
          </p>
        )}

        {!data && !error && (
          <p className="mt-4 text-[13px] text-[var(--ink-secondary)]">Chargement…</p>
        )}

        {data && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Projet" value={data.projectName} />
              <Stat label="Coût" value={usd(data.cost)} />
              <Stat label="Durée" value={duration(data.durationMs)} />
              <Stat label="Requêtes" value={`${data.requests.length}`} />
            </div>

            <ul className="mt-5 space-y-2">
              {data.requests.map((request, index) => (
                <li
                  key={`${request.time}-${index}`}
                  className="rounded-xl border border-[var(--border)] px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-[13px] font-medium text-[var(--ink)]">
                      {request.label}
                      {request.effort ? ` · effort ${request.effort}` : ""}
                    </span>
                    <span className="tabular text-[13px] font-semibold text-[var(--ink)]">
                      {usd(request.cost)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                    {formatDateTime(request.time)} · {compactTokens(request.outputTokens)} sortie ·{" "}
                    {compactTokens(request.cacheReadTokens)} relus
                    {request.cacheCause
                      ? ` · cache réécrit : ${CAUSE_LABELS[request.cacheCause] ?? request.cacheCause}`
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--ink-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--ink)]">{value}</p>
    </div>
  );
}
