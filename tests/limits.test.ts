import { describe, expect, it } from "vitest";

import {
  SESSION_WINDOW_MS,
  analyzeLimits,
  parseSample,
  type LimitSample,
} from "@/lib/limits";

import { makeEvent, makeScan } from "./helpers";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const NOW = Date.parse("2026-10-05T12:00:00.000Z");
const EMPTY = makeScan([]);

function sample(at: number, session: [number, number] | null, week: [number, number] | null = null) {
  return {
    at,
    session: session ? { used: session[0], resetAt: session[1] } : null,
    week: week ? { used: week[0], resetAt: week[1] } : null,
  } satisfies LimitSample;
}

describe("parseSample", () => {
  it("reads a statusline snapshot, with resets_at in seconds", () => {
    const parsed = parseSample({
      capturedAt: "2026-10-05T12:00:00.000Z",
      rate_limits: {
        five_hour: { used_percentage: 42.5, resets_at: 1_791_259_200 },
        seven_day: { used_percentage: 120 },
      },
    });
    expect(parsed).toEqual({
      at: NOW,
      session: { used: 0.425, resetAt: 1_791_259_200_000 },
      week: { used: 1, resetAt: null },
    });
  });

  it("rejects a snapshot without any usable window", () => {
    expect(parseSample({ capturedAt: "2026-10-05T12:00:00.000Z", rate_limits: {} })).toBeNull();
    expect(parseSample({ rate_limits: { five_hour: { used_percentage: 3 } } })).toBeNull();
    expect(parseSample("nope")).toBeNull();
  });
});

describe("analyzeLimits", () => {
  const reset = NOW + 3 * HOUR;

  it("projects when the limit will be hit at the recent pace", () => {
    const history = [
      sample(NOW - 90 * MINUTE, [0.1, reset]),
      sample(NOW - 60 * MINUTE, [0.2, reset]),
    ];
    const report = analyzeLimits(sample(NOW, [0.5, reset]), history, EMPTY, NOW);

    const projection = report?.session?.projection;
    // 30 points en une heure : les 50 restants tombent dans 1 h 40.
    expect(projection?.ratePerHour).toBeCloseTo(0.3);
    expect(Date.parse(projection!.hitsAt!)).toBeCloseTo(NOW + (5 / 3) * HOUR, -3);
    expect(projection?.usedAtReset).toBe(1);
    expect(report?.session?.series.map((point) => point.used)).toEqual([0.1, 0.2, 0.5]);
  });

  it("projects the share at reset when the limit is out of reach", () => {
    const history = [sample(NOW - 60 * MINUTE, [0.1, reset])];
    const report = analyzeLimits(sample(NOW, [0.2, reset]), history, EMPTY, NOW);

    expect(report?.session?.projection?.hitsAt).toBeNull();
    expect(report?.session?.projection?.usedAtReset).toBeCloseTo(0.5);
  });

  it("falls back to the average pace since the window opened", () => {
    // Fenêtre ouverte il y a 2 h, aucun relevé antérieur à la dernière heure.
    const report = analyzeLimits(sample(NOW, [0.4, reset]), [], EMPTY, NOW);
    expect(report?.session?.projection?.ratePerHour).toBeCloseTo(0.2);
  });

  it("ignores readings from a previous window", () => {
    const previousReset = reset - SESSION_WINDOW_MS;
    const history = [sample(NOW - 3 * HOUR, [0.9, previousReset])];
    const report = analyzeLimits(sample(NOW, [0.1, reset]), history, EMPTY, NOW);
    expect(report?.session?.series.map((point) => point.used)).toEqual([0.1]);
  });

  it("drops to zero once the window has reset since the last reading", () => {
    const report = analyzeLimits(sample(NOW - 2 * HOUR, [0.7, NOW - HOUR]), [], EMPTY, NOW);
    expect(report?.session).toMatchObject({ used: 0, expired: true, projection: null });
  });

  it("estimates the cap from the cost of past windows", () => {
    const resetA = NOW - 10 * HOUR;
    const resetB = NOW - 2 * HOUR;
    const scan = makeScan([
      // Fenêtre A : 10 $ jusqu'au relevé le plus haut (20 %), puis 50 $ non relevés.
      makeEvent({ time: resetA - 4 * HOUR, costTotal: 10 }),
      makeEvent({ time: resetA - HOUR / 2, costTotal: 50 }),
      // Fenêtre B : 4 $ pour 10 %.
      makeEvent({ time: resetB - 3 * HOUR, costTotal: 4 }),
      // Hors de toute fenêtre relevée.
      makeEvent({ time: NOW - 20 * HOUR, costTotal: 1_000 }),
    ]);
    const history = [
      sample(resetA - 3 * HOUR, [0.2, resetA]),
      sample(resetB - 2 * HOUR, [0.1, resetB]),
      // Trop peu entamée pour servir.
      sample(NOW - HOUR, [0.01, NOW + 4 * HOUR]),
    ];

    const cap = analyzeLimits(history[2], history.slice(0, 2), scan, NOW)?.session?.cap;
    // 0,50 $ et 0,40 $ par point : médiane 0,45 $.
    expect(cap?.windows).toBe(2);
    expect(cap?.costPerPercent).toBeCloseTo(0.45);
    expect(cap?.capCost).toBeCloseTo(45);
  });

  it("returns null without any reading", () => {
    expect(analyzeLimits(null, [], EMPTY, NOW)).toBeNull();
  });
});
