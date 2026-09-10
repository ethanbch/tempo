<div align="center">

# Tempo

**A local dashboard for your Claude Code usage** — cost, tokens, cache
efficiency, quota windows, and a breakdown by model and by project.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![100% local](https://img.shields.io/badge/data-100%25%20local-brightgreen)](#100-local--no-data-ever-leaves-your-machine)

</div>

---

Built for **Claude Pro and Max** subscribers who want to know what their
Claude Code sessions actually cost, without sending anything anywhere.

## Table of contents

- [Why Tempo](#why-tempo)
- [100% local — no data ever leaves your machine](#100-local--no-data-ever-leaves-your-machine)
- [Getting started](#getting-started)
- [What the cost number means](#what-the-cost-number-means)
- [Refresh strategy](#refresh-strategy)
- [Optimization levers](#optimization-levers)
- [5-hour quota windows](#5-hour-quota-windows)
- [Project structure](#project-structure)
- [Configuration](#configuration)
- [Design notes](#design-notes)
- [License](#license)

## Why Tempo

There's no public "Sign in with Claude" OAuth for individual claude.ai
accounts, and Anthropic's usage/cost APIs are reserved for organizations
(Admin or Analytics keys) — a Pro or Max subscription doesn't grant access to
them. The only real source of truth for an individual subscriber is local:
the transcripts Claude Code already writes to disk. Tempo reads them and
turns them into a dashboard.

## 100% local — no data ever leaves your machine

Tempo is a small Next.js app that runs on `localhost`. There is no login
screen and no account to create:

- It reads the transcripts Claude Code writes locally at
  `~/.claude/projects/**/*.jsonl`.
- It reads your account info from `~/.claude.json`, the config file Claude
  Code itself maintains.
- The only network request involved is your browser talking to the server
  running on your own machine. Nothing is sent to Anthropic, to Tempo's
  author, or to anyone else.

This also means Tempo only covers **Claude Code** usage, not conversations on
claude.ai, which leave no local trace.

## Getting started

```bash
git clone https://github.com/ethanbch/tempo.git
cd tempo
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). That's it — as long as
you've used Claude Code on this machine, Tempo will find its transcripts.

## What the cost number means

A Pro or Max subscription isn't billed per token. The number Tempo shows is
what the same usage would have cost at public API rates: it measures value
consumed, not an actual bill.

The calculation happens in two passes, because neither available source is
complete on its own:

1. **Visible requests.** Every assistant message in a transcript carries its
   own `usage`, priced against the rate card (`src/lib/pricing.ts`). Two
   traps live here: a single reply can span **multiple lines that all repeat
   the same `usage`** — the billing key is the API message id, not the
   line's — and a resumed session can rewrite its messages into a different
   file.
2. **Calibration.** Claude Code also makes billed calls it never logs: title
   generation, context compaction, utility tasks. At the end of a session it
   does write a `cost-state` record that totals everything, though. The
   ratio between the two gives a per-session factor — measured between 1.00
   and 1.26 on real sessions, median 1.11 — applied pro rata to each visible
   request.

Distributing the factor rather than adding a flat markup keeps the charts
consistent with the total, and keeps the period filter accurate. A session
still open has no `cost-state` yet: its factor is 1 and its cost is a floor.
The footer always shows what share of the total is calibrated.

### Verifying the pricing

```bash
npm run verify:pricing
```

The script replays the messages preceding each `cost-state` and reports the
calibration factor obtained, rather than a delta — the delta is structural
and expected. It only fails if a factor falls outside the plausible range,
which would signal a wrong rate or double counting. Sessions with no utility
call yield a factor of 1.000 to four decimal places — the best evidence that
the rate card is accurate. Models absent from transcripts (Haiku utility
calls) are flagged as unreconcilable.

## Refresh strategy

The dashboard updates **every 30 seconds**, and on page load. No outbound
network call: the only request is the browser talking to your own local
server.

Since it runs in the background, three guardrails keep the cost in check:

- **Nothing fires while the tab isn't visible.** Verified under real
  conditions: tab backgrounded for 61s, zero requests. Coming back to the
  tab catches up — but only if the data is more than 30 seconds old,
  otherwise flipping between two tabs would trigger a burst.
- **Never two requests in flight at once**, and changing the time period
  cancels any refresh in progress.
- **A background error stays silent**: the previous render stays on screen.

On the server side, two levels of reuse. A disk fingerprint — path, size,
and modification time of each file — short-circuits everything when nothing
moved; that's the common case, and the work reduces to one `stat` per file.
When a transcript has grown, it's re-read **only from the last byte already
parsed**: transcripts only ever grow by appending, so an active session only
costs its new lines.

Measured on a 17 MB corpus (14 transcripts):

| Situation | Duration |
| --- | --- |
| First scan, full parse | 100 ms |
| Refresh with nothing new | 4 ms |
| 40 new lines, incremental read | 4 ms |

Without incremental reads, the third row would cost the same 100 ms as the
first: the gain is roughly **25×** once a session is active. Memory is
stable — 200 consecutive refreshes, i.e. 100 minutes of runtime, with no
monotonic growth.

Equality between incremental and full-parse reads is verified: truncating a
transcript by 300 lines and then replaying them, the result from incremental
appends matches a fresh process parsing everything from scratch.

## Optimization levers

The dashboard doesn't just count — it derives from the same requests what
you can actually act on, following the distinction from Anthropic's own cost
optimization guidance.

**Free wins** — they lower spend without touching quality:

- **Context repaid after a pause.** A cache entry expires after an hour of
  inactivity. Resuming a long session after a break rewrites its entire
  context at the write rate (2× the read price). Every cache write is
  attributed to its cause by replaying sessions: opening, normal growth,
  resume-after-expiry, model switch, effort switch.
- **Cache invalidated mid-session.** Switching model or effort level
  mid-session invalidates the cache and repays the entire history.
- **Context past the comfort threshold.** Every turn resends the whole
  history: a session's cost grows roughly as the square of the number of
  turns.
- **Sub-agent cost**, when there is any.

**Trade-offs** — they exchange cost for intelligence, and don't apply
automatically: effort level (with the share of output tokens spent on
reasoning) and model mix.

### Two honesty rules in the numbers

**A trade-off never shows a saving.** For these levers, the amount shown is
the *spend involved*, not a locked-in gain — the gain would be paid for in
quality, and nothing here can measure that loss. Only free wins show an
*avoidable overspend*.

**An avoidable overspend only counts the part that's actually avoidable.**
The long-context lever doesn't total the cost of every large-context
request — most of that context is the actual work. It only counts the
fraction re-read *beyond* the threshold, i.e. what systematic compaction
would have avoided. The line items also draw on disjoint token types (cache
writes for resumes and invalidations, cache reads for long context), so the
sum of the levers can never exceed the bill.

## 5-hour quota windows

Claude's quota recharges on a rolling window opened by the first request
after a pause. Tempo replays that rule over your history.

Anthropic doesn't publish a numeric token cap for Pro and Max, and making
one up would produce a false gauge. So the gauge reads **relative to your
busiest window** instead: a measurable comparison, rather than a percentage
of an unknown cap.

## Project structure

| Path | Role |
| --- | --- |
| `src/lib/pricing.ts` | Rate card and cost calculation |
| `src/lib/scan.ts` | Streaming transcript reads, deduplication, in-memory cache |
| `src/lib/aggregate.ts` | Calibration and aggregations (day, model, project, window) |
| `src/lib/insights.ts` | Optimization levers: cache-write attribution, effort, models |
| `src/lib/series.ts` | Stable per-model color assignment |
| `src/components/charts/` | Hand-written SVG charts |
| `scripts/verify-pricing.ts` | Pricing verification against ground truth |

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLAUDE_PROJECTS_PATH` | `~/.claude/projects` | Where transcripts are read from |
| `CLAUDE_CONFIG_PATH` | `~/.claude.json` | Where account info is read from |

## Design notes

The categorical palette and the sequential ramp were validated against the
app's real surfaces in both themes: lightness band, chroma floor, separation
under color-blindness simulation, and contrast. Two hues fall below 3:1 in
light mode; direct end-of-bar labels and the table view (the "View table"
button) are the required compensation, not an extra. Charts are hand-written
SVG to match brand specs — rounded data-side caps, a 2px gap between
adjoining segments, bars capped at 24px.

Effort level is an *ordered* scale, not a list of categories: it takes a
single-hue ramp whose steps rise with the level, rather than per-series
colors. The two steps closest to the ground are dropped — they exist to
represent "almost zero" on a continuous scale and don't hold the minimum
contrast required of an ordered scale.

## Tech stack

Next.js · React · TypeScript · Tailwind CSS · hand-written SVG charts (no
charting library).

## License

[MIT](LICENSE)
