"use client";

import type { DailyPoint } from "@/lib/aggregate";
import { compactTokens, formatDayLong, integer, usd } from "@/lib/format";

/**
 * Vue tableau des séries journalières.
 *
 * Ce n'est pas un supplément : la palette comporte des teintes qui passent sous
 * 3:1 de contraste en mode clair, et la méthode dataviz exige alors un canal de
 * secours où chaque valeur reste lisible sans survol ni distinction de couleur.
 */
export function UsageTable({ daily }: { daily: DailyPoint[] }) {
  const rows = [...daily].reverse();
  const totals = daily.reduce(
    (accumulator, point) => ({
      requests: accumulator.requests + point.requests,
      inputTokens: accumulator.inputTokens + point.inputTokens,
      cacheWriteTokens: accumulator.cacheWriteTokens + point.cacheWriteTokens,
      cacheReadTokens: accumulator.cacheReadTokens + point.cacheReadTokens,
      outputTokens: accumulator.outputTokens + point.outputTokens,
      cost: accumulator.cost + point.cost,
    }),
    {
      requests: 0,
      inputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      cost: 0,
    },
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <caption className="sr-only">
          Usage par jour : requêtes, tokens par type et coût équivalent API
        </caption>
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[12px] text-[var(--ink-muted)]">
            <th scope="col" className="py-2 pr-4 font-medium">
              Jour
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Requêtes
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Entrée
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Écriture cache
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Lecture cache
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Sortie
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Coût
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((point) => (
            <tr key={point.date} className="border-b border-[var(--border)] last:border-0">
              <th scope="row" className="py-2 pr-4 text-left font-normal text-[var(--ink)]">
                {formatDayLong(point.date)}
              </th>
              <td className="tabular py-2 pr-4 text-right text-[var(--ink-secondary)]">
                {integer(point.requests)}
              </td>
              <td className="tabular py-2 pr-4 text-right text-[var(--ink-secondary)]">
                {compactTokens(point.inputTokens)}
              </td>
              <td className="tabular py-2 pr-4 text-right text-[var(--ink-secondary)]">
                {compactTokens(point.cacheWriteTokens)}
              </td>
              <td className="tabular py-2 pr-4 text-right text-[var(--ink-secondary)]">
                {compactTokens(point.cacheReadTokens)}
              </td>
              <td className="tabular py-2 pr-4 text-right text-[var(--ink-secondary)]">
                {compactTokens(point.outputTokens)}
              </td>
              <td className="tabular py-2 text-right font-medium text-[var(--ink)]">
                {usd(point.cost, true)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--border-strong)] font-medium">
            <th scope="row" className="py-2 pr-4 text-left">
              Total
            </th>
            <td className="tabular py-2 pr-4 text-right">{integer(totals.requests)}</td>
            <td className="tabular py-2 pr-4 text-right">{compactTokens(totals.inputTokens)}</td>
            <td className="tabular py-2 pr-4 text-right">
              {compactTokens(totals.cacheWriteTokens)}
            </td>
            <td className="tabular py-2 pr-4 text-right">
              {compactTokens(totals.cacheReadTokens)}
            </td>
            <td className="tabular py-2 pr-4 text-right">{compactTokens(totals.outputTokens)}</td>
            <td className="tabular py-2 text-right">{usd(totals.cost)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
