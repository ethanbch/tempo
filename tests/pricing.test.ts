import { describe, expect, it } from "vitest";

import { computeCost, priceFor } from "@/lib/pricing";

const tokens = (input: number, output: number, cacheRead = 0) => ({
  inputTokens: input,
  outputTokens: output,
  cacheReadTokens: cacheRead,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
});

describe("5.5 models", () => {
  it("have exact rates, not the family fallback", () => {
    for (const id of ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]) {
      expect(priceFor(id).estimated).toBe(false);
    }
  });

  it("price Opus 5.5 at $4 / $20 with cache reads at $0.20", () => {
    const cost = computeCost("claude-opus-5-5", tokens(1_000_000, 1_000_000, 1_000_000));
    expect(cost.input).toBeCloseTo(4);
    expect(cost.output).toBeCloseTo(20);
    expect(cost.cacheRead).toBeCloseTo(0.2);
  });

  it("price Opus 5.5 fast mode at $8 / $40", () => {
    const cost = computeCost("claude-opus-5-5", tokens(1_000_000, 1_000_000), "fast");
    expect(cost.input + cost.output).toBeCloseTo(48);
  });

  it("price Sonnet 5.5 at $2 / $10", () => {
    const cost = computeCost("claude-sonnet-5-5", tokens(1_000_000, 1_000_000));
    expect(cost.input + cost.output).toBeCloseTo(12);
  });

  it("price Haiku 5.5 at $0.10 / $0.50, and $0.50 / $2.50 above 100K prompt tokens", () => {
    const small = computeCost("claude-haiku-5-5", tokens(100_000, 1_000_000));
    expect(small.input).toBeCloseTo(0.01);
    expect(small.output).toBeCloseTo(0.5);
    const large = computeCost("claude-haiku-5-5", tokens(200_000, 1_000_000));
    expect(large.input).toBeCloseTo(0.1);
    expect(large.output).toBeCloseTo(2.5);
  });
});
