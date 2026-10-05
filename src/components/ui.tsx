"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { useI18n } from "@/components/I18nProvider";

/** Les huit emplacements catégoriels, dans leur ordre figé. */
export const SERIES_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
] as const;

/** Les sept pas de la rampe séquentielle, du plus clair au plus foncé. */
export const RAMP_VARS = [
  "var(--ramp-1)",
  "var(--ramp-2)",
  "var(--ramp-3)",
  "var(--ramp-4)",
  "var(--ramp-5)",
  "var(--ramp-6)",
  "var(--ramp-7)",
] as const;

/**
 * Sous-ensemble de la rampe utilisable pour une échelle **ordonnée**.
 *
 * Un encodage ordinal doit rester lisible à chaque pas : la méthode impose au
 * pas le plus proche de la surface un contraste d'au moins 2:1. Les deux
 * premiers pas de la rampe séquentielle n'y satisfont pas — ils sont faits pour
 * représenter « presque zéro » en se fondant dans le fond — d'où ce départ au
 * quatrième pas, validé dans les deux thèmes.
 */
export const ORDINAL_VARS = [
  "var(--ramp-4)",
  "var(--ramp-5)",
  "var(--ramp-6)",
  "var(--ramp-7)",
] as const;

/** Espace laissé dans la couleur de surface entre deux marques jointives. */
export const SURFACE_GAP = 2;
/** Épaisseur maximale d'une barre : au-delà, la barre remplit son couloir. */
export const MAX_BAR = 24;
/** Rayon de l'extrémité arrondie d'une barre, côté données. */
export const BAR_RADIUS = 4;

/**
 * Explication à la demande : un ⓘ discret qui ouvre une bulle au survol, au
 * focus clavier ou au toucher. Les cartes gardent ainsi un titre court.
 */
export function InfoTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="grid h-[18px] w-[18px] place-items-center rounded-full text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.2V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="5" r=".9" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-[-8px] top-7 z-30 w-[min(300px,80vw)] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[12.5px] font-normal normal-case leading-relaxed tracking-normal text-[var(--ink-secondary)] shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function Card({
  title,
  info,
  action,
  children,
  className = "",
}: {
  title?: string;
  /** Explication affichée dans une bulle ⓘ à côté du titre. */
  info?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    // `min-w-0` est indispensable : sans lui un enfant de grille garde
    // `min-width: auto`, la piste ne peut pas descendre sous la largeur du SVG
    // déjà dessiné, et le ResizeObserver ne voit jamais la fenêtre rétrécir.
    <section
      className={`min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 ${className}`}
    >
      {(title || action) && (
        // Une carte repliée n'a que son en-tête : pas d'espace pour un corps absent.
        <header className={`flex items-center justify-between gap-4 ${children ? "mb-4" : ""}`}>
          <div className="flex min-w-0 items-center gap-1.5">
            {title && <h2 className="eyebrow">{title}</h2>}
            {info && <InfoTip text={info} label={t.method.info} />}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * Jauge en segments, le langage visuel de la statusline : chaque segment est
 * une part fixe, ceux qui sont atteints s'allument.
 */
export function SegmentedMeter({
  value,
  color,
  label,
  segments = 20,
}: {
  /** Part consommée, entre 0 et 1. */
  value: number;
  color: string;
  label: string;
  segments?: number;
}) {
  // Une consommation non nulle allume toujours au moins un segment.
  const lit = value > 0 ? Math.max(1, Math.round(Math.min(1, value) * segments)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: segments }, (_, index) => (
        <span
          key={index}
          className="h-2.5 rounded-[2px]"
          style={{ background: index < lit ? color : "var(--surface-sunken)" }}
        />
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-[13px] text-[var(--ink-secondary)]">{label}</p>
      <p
        className={`mt-1.5 font-semibold text-[var(--ink)] ${
          emphasis ? "text-[40px] leading-[1.1]" : "text-[26px] leading-tight"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[12px] text-[var(--ink-muted)]">{hint}</p>}
    </div>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  /** Une ligne pour les courbes, un rectangle pour les barres et les aires. */
  shape?: "rect" | "line";
}

/** La légende est le canal d'identité fiable : présente dès deux séries. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            style={{ background: item.color }}
            className={
              item.shape === "line"
                ? "inline-block h-[2px] w-3.5 rounded-full"
                : "inline-block h-2.5 w-2.5 rounded-[3px]"
            }
          />
          <span className="text-[12px] text-[var(--ink-secondary)]">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

/**
 * Infobulle positionnée au-dessus du graphique.
 *
 * La valeur porte le poids typographique et le nom de série reste secondaire :
 * à ce stade le lecteur sait déjà quelle série il vise, il veut le nombre.
 */
export function ChartTooltip({ state, width }: { state: TooltipState | null; width: number }) {
  if (!state) return null;

  // On bascule l'infobulle du côté opposé quand elle sortirait du cadre.
  const ESTIMATED_WIDTH = 210;
  const flip = state.x + ESTIMATED_WIDTH + 16 > width;

  return (
    <div
      role="tooltip"
      style={{
        left: state.x,
        top: state.y,
        transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
      }}
      className="pointer-events-none absolute z-20 w-max min-w-[168px] max-w-[210px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg shadow-black/5"
    >
      <p className="text-[12px] font-medium text-[var(--ink-secondary)]">{state.title}</p>
      <ul className="mt-1.5 space-y-1">
        {state.rows.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5">
              {row.color && (
                <span
                  aria-hidden
                  style={{ background: row.color }}
                  className="inline-block h-[2px] w-3 rounded-full"
                />
              )}
              <span className="truncate text-[12px] text-[var(--ink-secondary)]">{row.label}</span>
            </span>
            <span className="tabular shrink-0 whitespace-nowrap text-[13px] font-semibold text-[var(--ink)]">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mesure la largeur disponible d'un conteneur, pour dessiner en pixels réels. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/**
 * Trace une barre dont seule l'extrémité « données » est arrondie.
 *
 * `side` indique de quel côté se trouve cette extrémité ; le côté opposé, ancré
 * sur la ligne de base, reste à angle droit.
 */
export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  side: "top" | "right" | "none",
): string {
  if (height <= 0 || width <= 0) return "";
  if (side === "none") return `M${x},${y}h${width}v${height}h${-width}Z`;

  if (side === "top") {
    const r = Math.min(radius, width / 2, height);
    return (
      `M${x},${y + height}` +
      `V${y + r}` +
      `a${r},${r} 0 0 1 ${r},${-r}` +
      `h${width - 2 * r}` +
      `a${r},${r} 0 0 1 ${r},${r}` +
      `V${y + height}` +
      `Z`
    );
  }

  const r = Math.min(radius, height / 2, width);
  return (
    `M${x},${y}` +
    `h${width - r}` +
    `a${r},${r} 0 0 1 ${r},${r}` +
    `V${y + height - r}` +
    `a${r},${r} 0 0 1 ${-r},${r}` +
    `H${x}` +
    `Z`
  );
}

/** État vide homogène, affiché quand une période ne contient aucune donnée. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-6 text-center text-[13px] text-[var(--ink-muted)]">
      {message}
    </div>
  );
}
