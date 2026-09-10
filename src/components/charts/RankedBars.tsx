"use client";

import { useState } from "react";

import {
  BAR_RADIUS,
  ChartTooltip,
  EmptyState,
  MAX_BAR,
  type TooltipRow,
  type TooltipState,
  barPath,
  useMeasure,
} from "@/components/ui";

export interface RankedItem {
  key: string;
  label: string;
  /** Grandeur portée par la longueur de la barre. */
  value: number;
  /** Couleur de la marque : une teinte stable par entité, jamais par rang. */
  color: string;
  /** Ligne d'appui sous l'étiquette. */
  caption?: string;
  /** Détail affiché au survol et au focus. */
  detail?: TooltipRow[];
}

const ROW_HEIGHT = 40;
const DEFAULT_LABEL_WIDTH = 148;

/**
 * Largeur moyenne d'un caractère, aux deux corps utilisés dans la gouttière.
 * Sert à déduire combien de caractères y tiennent, plutôt que de figer un
 * budget qui déborderait dès qu'on élargit la colonne.
 */
const CHAR_WIDTH_LABEL = 6.6;
const CHAR_WIDTH_CAPTION = 5.4;

/** Tronque proprement, plutôt que de laisser un texte déborder sur la barre. */
function clamp(text: string, budget: number): string {
  return text.length > budget ? `${text.slice(0, budget - 1)}…` : text;
}

/**
 * Barres horizontales classées, une entité par ligne.
 *
 * La valeur est écrite au bout de chaque barre : ces séries comportent des
 * teintes qui passent sous 3:1 en mode clair, et l'étiquette directe est la
 * compensation exigée par la méthode — elle n'est pas décorative.
 */
export function RankedBars({
  items,
  formatValue,
  emptyMessage = "Aucune donnée sur cette période.",
  labelWidth = DEFAULT_LABEL_WIDTH,
}: {
  items: RankedItem[];
  formatValue: (value: number) => string;
  emptyMessage?: string;
  /** Largeur de la gouttière d'étiquettes, à élargir quand les noms sont longs. */
  labelWidth?: number;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  if (items.length === 0) return <EmptyState message={emptyMessage} />;

  const height = items.length * ROW_HEIGHT;
  const max = Math.max(...items.map((item) => item.value), 0) || 1;
  // On réserve la place de l'étiquette de valeur au bout de la barre.
  const valueWidth = 86;
  const trackWidth = Math.max(0, width - labelWidth - valueWidth);
  const barThickness = Math.min(MAX_BAR, ROW_HEIGHT - 16);
  const labelChars = Math.floor((labelWidth - 10) / CHAR_WIDTH_LABEL);
  const captionChars = Math.floor((labelWidth - 10) / CHAR_WIDTH_CAPTION);

  return (
    <div ref={ref} className="relative w-full min-w-0">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Classement par valeur">
          {items.map((item, index) => {
            const y = index * ROW_HEIGHT;
            const barY = y + (ROW_HEIGHT - barThickness) / 2;
            const barWidth = Math.max(2, (item.value / max) * trackWidth);
            const dimmed = hovered !== null && hovered !== item.key;

            return (
              <g
                key={item.key}
                tabIndex={0}
                role="button"
                aria-label={`${item.label} : ${formatValue(item.value)}`}
                className="outline-none"
                onPointerMove={(event) => {
                  const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  setHovered(item.key);
                  setTooltip({
                    x: Math.min(labelWidth + barWidth, width - 24),
                    y: box ? event.clientY - box.top : y + ROW_HEIGHT / 2,
                    title: item.label,
                    rows: item.detail ?? [
                      { label: "Valeur", value: formatValue(item.value), color: item.color },
                    ],
                  });
                }}
                onPointerLeave={() => {
                  setHovered(null);
                  setTooltip(null);
                }}
                onFocus={() => {
                  setHovered(item.key);
                  setTooltip({
                    x: Math.min(labelWidth + barWidth, width - 24),
                    y: y + ROW_HEIGHT / 2,
                    title: item.label,
                    rows: item.detail ?? [
                      { label: "Valeur", value: formatValue(item.value), color: item.color },
                    ],
                  });
                }}
                onBlur={() => {
                  setHovered(null);
                  setTooltip(null);
                }}
              >
                <rect x={0} y={y} width={width} height={ROW_HEIGHT} fill="transparent" />

                <text
                  x={0}
                  y={y + ROW_HEIGHT / 2}
                  dy={item.caption ? "-0.15em" : "0.32em"}
                  fontSize={13}
                  fill="var(--ink)"
                >
                  {clamp(item.label, labelChars)}
                </text>
                {item.caption && (
                  <text x={0} y={y + ROW_HEIGHT / 2} dy="1.15em" fontSize={11} fill="var(--ink-muted)">
                    {clamp(item.caption, captionChars)}
                  </text>
                )}

                <path
                  d={barPath(labelWidth, barY, barWidth, barThickness, BAR_RADIUS, "right")}
                  fill={item.color}
                  opacity={dimmed ? 0.45 : 1}
                />

                <text
                  x={labelWidth + barWidth + 10}
                  y={y + ROW_HEIGHT / 2}
                  dy="0.32em"
                  fontSize={12}
                  className="tabular"
                  fill="var(--ink-secondary)"
                >
                  {formatValue(item.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <ChartTooltip state={tooltip} width={width} />
    </div>
  );
}
