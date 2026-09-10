"use client";

import { useState } from "react";

import type { CostParts, DailyPoint } from "@/lib/aggregate";
import { formatDay, formatDayLong, niceTicks, usd, usdAxis } from "@/lib/format";
import {
  BAR_RADIUS,
  ChartTooltip,
  EmptyState,
  Legend,
  MAX_BAR,
  SERIES_VARS,
  SURFACE_GAP,
  type TooltipState,
  barPath,
  useMeasure,
} from "@/components/ui";

/** Les quatre postes de dépense, dans l'ordre d'empilement (bas vers haut). */
const SERIES = [
  { key: "input", label: "Entrée", color: SERIES_VARS[0] },
  { key: "cacheWrite", label: "Écriture cache", color: SERIES_VARS[1] },
  { key: "cacheRead", label: "Lecture cache", color: SERIES_VARS[2] },
  { key: "output", label: "Sortie", color: SERIES_VARS[3] },
] as const satisfies ReadonlyArray<{
  key: keyof CostParts;
  label: string;
  color: string;
}>;

const HEIGHT = 260;
const MARGIN = { top: 12, right: 14, bottom: 26, left: 58 };

export function StackedCost({ data }: { data: DailyPoint[] }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [focused, setFocused] = useState<number | null>(null);

  if (data.length === 0) {
    return <EmptyState message="Aucune requête sur cette période." />;
  }

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxTotal = Math.max(...data.map((point) => point.cost), 0);
  const ticks = niceTicks(maxTotal);
  const scaleMax = ticks[ticks.length - 1] || 1;
  const y = (value: number) => plotHeight - (value / scaleMax) * plotHeight;

  const band = plotWidth / data.length;
  const barWidth = Math.min(MAX_BAR, Math.max(2, band - 6));

  // Un jour sur N porte une étiquette, pour que l'axe ne se chevauche jamais.
  const labelStride = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotWidth / 64))));

  const showTooltip = (index: number, clientY: number | null) => {
    const point = data[index];
    const rows = [...SERIES]
      .reverse()
      .filter((series) => point.costParts[series.key] > 0)
      .map((series) => ({
        label: series.label,
        value: usd(point.costParts[series.key], true),
        color: series.color,
      }));
    setTooltip({
      x: MARGIN.left + index * band + band / 2,
      y: clientY ?? MARGIN.top + plotHeight / 2,
      title: `${formatDayLong(point.date)} · ${usd(point.cost)}`,
      rows:
        rows.length > 0
          ? [...rows, { label: "Requêtes", value: String(point.requests) }]
          : [{ label: "Aucune requête", value: "0" }],
    });
    setFocused(index);
  };

  const hide = () => {
    setTooltip(null);
    setFocused(null);
  };

  return (
    <div>
      <div ref={ref} className="relative w-full min-w-0">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Coût équivalent API par jour, ventilé par poste de dépense"
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={0}
                    x2={plotWidth}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke={tick === 0 ? "var(--axis)" : "var(--grid)"}
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                  <text
                    x={-10}
                    y={y(tick)}
                    dy="0.32em"
                    textAnchor="end"
                    className="tabular"
                    fontSize={11}
                    fill="var(--ink-muted)"
                  >
                    {usdAxis(tick)}
                  </text>
                </g>
              ))}

              {data.map((point, index) => {
                const x = index * band + (band - barWidth) / 2;
                const segments = SERIES.map((series) => ({
                  series,
                  value: point.costParts[series.key],
                })).filter((segment) => segment.value > 0);

                let cursor = 0;
                return (
                  <g key={point.date}>
                    {segments.map((segment, segmentIndex) => {
                      const bottom = y(cursor);
                      cursor += segment.value;
                      const top = y(cursor);
                      const isTop = segmentIndex === segments.length - 1;
                      // Le vide de 2 px entre segments jointifs est ce qui les
                      // sépare : jamais un contour, qui ajouterait de l'encre.
                      const gap = isTop ? 0 : SURFACE_GAP;
                      const height = Math.max(0, bottom - top - gap);
                      if (height <= 0) return null;
                      return (
                        <path
                          key={segment.series.key}
                          d={barPath(
                            x,
                            top,
                            barWidth,
                            height,
                            BAR_RADIUS,
                            isTop ? "top" : "none",
                          )}
                          fill={segment.series.color}
                          opacity={focused === null || focused === index ? 1 : 0.45}
                        />
                      );
                    })}
                  </g>
                );
              })}

              {data.map((point, index) =>
                index % labelStride === 0 ? (
                  <text
                    key={point.date}
                    x={index * band + band / 2}
                    y={plotHeight + 17}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--ink-muted)"
                  >
                    {formatDay(point.date)}
                  </text>
                ) : null,
              )}

              {/* La cible de survol couvre tout le couloir, pas seulement la barre. */}
              {data.map((point, index) => (
                <rect
                  key={`hit-${point.date}`}
                  x={index * band}
                  y={0}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${formatDayLong(point.date)} : ${usd(point.cost)}`}
                  onPointerMove={(event) => {
                    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                    showTooltip(index, box ? event.clientY - box.top : null);
                  }}
                  onPointerLeave={hide}
                  onFocus={() => showTooltip(index, null)}
                  onBlur={hide}
                  className="outline-none"
                />
              ))}
            </g>
          </svg>
        )}
        <ChartTooltip state={tooltip} width={width} />
      </div>

      <div className="mt-3">
        <Legend items={SERIES.map((series) => ({ label: series.label, color: series.color }))} />
      </div>
    </div>
  );
}
