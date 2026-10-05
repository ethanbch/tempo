import { describe, expect, it } from "vitest";

import { QUOTA_WINDOW_MS, buildCalibration, buildReport } from "@/lib/aggregate";

import { makeEvent, makeScan, makeSessionCost } from "./helpers";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-10-05T12:00:00.000Z");

describe("buildCalibration", () => {
  it("spreads the authoritative session cost over its visible requests", () => {
    const scan = makeScan(
      [
        makeEvent({ time: NOW - 3 * HOUR, costTotal: 2, sessionId: "a" }),
        makeEvent({ time: NOW - 2 * HOUR, costTotal: 3, sessionId: "a" }),
        makeEvent({ time: NOW - HOUR, costTotal: 4, sessionId: "open" }),
      ],
      [makeSessionCost("a", 5.5)],
    );

    const calibration = buildCalibration(scan);
    expect(calibration.get("a")).toBeCloseTo(1.1);
    // Une session encore ouverte n'a pas de relevé : pas de facteur.
    expect(calibration.has("open")).toBe(false);
  });
});

describe("buildReport", () => {
  it("reconciles calibrated and raw costs", () => {
    const scan = makeScan(
      [
        makeEvent({ time: NOW - 3 * HOUR, costTotal: 2, sessionId: "a" }),
        makeEvent({ time: NOW - 2 * HOUR, costTotal: 3, sessionId: "a" }),
        makeEvent({ time: NOW - HOUR, costTotal: 4, sessionId: "open" }),
      ],
      [makeSessionCost("a", 5.5)],
    );

    const report = buildReport(scan, "all", NOW);
    expect(report.summary.cost).toBeCloseTo(9.5);
    expect(report.reconciliation.rawCost).toBeCloseTo(9);
    expect(report.reconciliation.untrackedCost).toBeCloseTo(0.5);
    expect(report.reconciliation.uncalibratedSessions).toBe(1);
  });

  it("opens a new 5-hour window on the first request past the previous one", () => {
    const start = NOW - 12 * HOUR;
    const scan = makeScan([
      makeEvent({ time: start }),
      makeEvent({ time: start + QUOTA_WINDOW_MS - 1 }),
      makeEvent({ time: start + QUOTA_WINDOW_MS }),
      makeEvent({ time: NOW - HOUR }),
    ]);

    const { blocks } = buildReport(scan, "all", NOW);
    expect(blocks.map((block) => block.requests)).toEqual([2, 1, 1]);
    expect(blocks.map((block) => block.active)).toEqual([false, false, true]);
  });

  it("compares with the previous period of the same length", () => {
    const scan = makeScan([
      makeEvent({ time: NOW - 30 * HOUR, costTotal: 4 }),
      makeEvent({ time: NOW - 30 * HOUR, costTotal: 7, projectId: "other" }),
      makeEvent({ time: NOW - 60 * HOUR, costTotal: 100 }),
      makeEvent({ time: NOW - HOUR, costTotal: 6 }),
    ]);

    expect(buildReport(scan, "24h", NOW).summary.previousCost).toBeCloseTo(11);
    expect(buildReport(scan, "24h", NOW, { projectId: "other" }).summary.previousCost).toBeCloseTo(7);
    expect(buildReport(scan, "all", NOW).summary.previousCost).toBeNull();
  });

  it("filters by period and by project", () => {
    const scan = makeScan([
      makeEvent({ time: NOW - 48 * HOUR, costTotal: 10 }),
      makeEvent({ time: NOW - HOUR, costTotal: 1 }),
      makeEvent({ time: NOW - HOUR, costTotal: 5, projectId: "other" }),
    ]);

    expect(buildReport(scan, "24h", NOW).summary.cost).toBeCloseTo(6);
    expect(buildReport(scan, "all", NOW, { projectId: "other" }).summary.cost).toBeCloseTo(5);
  });
});
