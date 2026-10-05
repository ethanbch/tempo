"use client";

import { useState } from "react";

import type { HeatCell } from "@/lib/aggregate";
import { useI18n } from "@/components/I18nProvider";
import {
  ChartTooltip,
  EmptyState,
  RAMP_VARS,
  type TooltipState,
  useMeasure,
} from "@/components/ui";

/** Jours de la semaine, 0 = lundi : leurs libellés viennent de la langue choisie. */
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const ROW_LABEL_WIDTH = 34;
const ROW_HEIGHT = 22;
const CELL_GAP = 2;

/**
 * Répartition des requêtes par jour de la semaine et heure.
 *
 * L'encodage est séquentiel : une seule teinte, du clair au foncé. Les cases
 * sans activité prennent la couleur de fond creusée plutôt que le premier pas de
 * la rampe, pour que « zéro » se distingue de « presque zéro ».
 */
export function ActivityHeatmap({ cells }: { cells: HeatCell[] }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const { t, f } = useI18n();
  const { integer, usd } = f;

  const byKey = new Map(cells.map((cell) => [`${cell.weekday}-${cell.hour}`, cell]));
  const max = Math.max(...cells.map((cell) => cell.requests), 0);

  if (max === 0) return <EmptyState message={t.charts.heatmapEmpty} />;

  const gridWidth = Math.max(0, width - ROW_LABEL_WIDTH);
  const cellWidth = gridWidth / HOURS.length;
  const height = WEEKDAYS.length * ROW_HEIGHT + 20;

  /** Répartit les valeurs sur les sept pas de la rampe. */
  const rampStep = (requests: number) => {
    if (requests === 0) return "var(--surface-sunken)";
    const step = Math.ceil((requests / max) * RAMP_VARS.length) - 1;
    return RAMP_VARS[Math.min(RAMP_VARS.length - 1, Math.max(0, step))];
  };

  return (
    <div>
      <div ref={ref} className="relative w-full min-w-0">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={t.charts.heatmapAria}
          >
            {WEEKDAYS.map((day, weekday) => (
              <text
                key={day}
                x={0}
                y={weekday * ROW_HEIGHT + ROW_HEIGHT / 2}
                dy="0.32em"
                fontSize={11}
                fill="var(--ink-muted)"
              >
                {f.weekday(day)}
              </text>
            ))}

            {WEEKDAYS.map((_, weekday) =>
              HOURS.map((hour) => {
                const cell = byKey.get(`${weekday}-${hour}`);
                const requests = cell?.requests ?? 0;
                const x = ROW_LABEL_WIDTH + hour * cellWidth;
                const y = weekday * ROW_HEIGHT;
                return (
                  <rect
                    key={`${weekday}-${hour}`}
                    x={x}
                    y={y}
                    width={Math.max(1, cellWidth - CELL_GAP)}
                    height={ROW_HEIGHT - CELL_GAP}
                    rx={3}
                    fill={rampStep(requests)}
                    tabIndex={requests > 0 ? 0 : -1}
                    className="outline-none"
                    onPointerEnter={(event) => {
                      const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      setTooltip({
                        x: x + cellWidth / 2,
                        y: box ? y + ROW_HEIGHT / 2 : y,
                        title: `${f.weekday(weekday)} · ${f.hourOfDay(hour)}`,
                        rows: [
                          { label: t.common.requests, value: integer(requests) },
                          { label: t.common.cost, value: usd(cell?.cost ?? 0, true) },
                        ],
                      });
                    }}
                    onPointerLeave={() => setTooltip(null)}
                    onFocus={() =>
                      setTooltip({
                        x: x + cellWidth / 2,
                        y: y + ROW_HEIGHT / 2,
                        title: `${f.weekday(weekday)} · ${f.hourOfDay(hour)}`,
                        rows: [
                          { label: t.common.requests, value: integer(requests) },
                          { label: t.common.cost, value: usd(cell?.cost ?? 0, true) },
                        ],
                      })
                    }
                    onBlur={() => setTooltip(null)}
                  />
                );
              }),
            )}

            {HOURS.filter((hour) => hour % 3 === 0).map((hour) => (
              <text
                key={`hour-${hour}`}
                x={ROW_LABEL_WIDTH + hour * cellWidth}
                y={WEEKDAYS.length * ROW_HEIGHT + 12}
                fontSize={10}
                fill="var(--ink-muted)"
              >
                {`${hour}`.padStart(2, "0")}
              </text>
            ))}
          </svg>
        )}
        <ChartTooltip state={tooltip} width={width} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-[var(--ink-muted)]">{t.charts.less}</span>
        {RAMP_VARS.map((color) => (
          <span
            key={color}
            aria-hidden
            style={{ background: color }}
            className="inline-block h-2.5 w-5 rounded-[3px]"
          />
        ))}
        <span className="text-[11px] text-[var(--ink-muted)]">
          {t.charts.more(integer(max))}
        </span>
      </div>
    </div>
  );
}
