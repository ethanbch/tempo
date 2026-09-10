<div align="center">

# Tempo

**A local dashboard for your Claude Code usage** — cost, tokens, cache
efficiency, quota windows, and a breakdown by model and by project.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![100% local](https://img.shields.io/badge/data-100%25%20local-brightgreen)](#-100%25-local-no-data-ever-leaves-your-machine)

*(Lire ce document [en français](README.md).)*

</div>

---

Built for **Claude Pro and Max** subscribers who want to know what their
Claude Code sessions actually cost, without sending anything anywhere.

## Table of contents

- [Why Tempo](#why-tempo)
- [100% local — no data ever leaves your machine](#100-local--no-data-ever-leaves-your-machine)
- [Features](#features)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Tech stack](#tech-stack)
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

## Features

- 💰 **Cost tracking** — what your usage would have cost at public API rates
  (Pro/Max isn't billed per token, so this measures value consumed, not a
  real invoice), calibrated against Claude Code's own end-of-session cost
  records.
- 📊 **Breakdowns** by day, model, and project.
- ⏱️ **5-hour quota windows** replayed from your history, so you can see your
  busiest windows relative to each other.
- 🎯 **Optimization levers** — cache rewritten after a session resumes past
  its 1-hour expiry, cache invalidated by switching model or effort
  mid-session, context growing past a comfortable size, effort level, and
  model mix.
- 🔄 **Auto-refresh** every 30 seconds, paused whenever the tab isn't
  visible, with incremental re-reads so an active session only costs its new
  lines.

## Getting started

```bash
git clone https://github.com/ethanbch/tempo.git
cd tempo
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). That's it — as long as
you've used Claude Code on this machine, Tempo will find its transcripts.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLAUDE_PROJECTS_PATH` | `~/.claude/projects` | Where transcripts are read from |
| `CLAUDE_CONFIG_PATH` | `~/.claude.json` | Where account info is read from |

## Tech stack

Next.js · React · TypeScript · Tailwind CSS · hand-written SVG charts (no
charting library).

See [README.md](README.md) (in French) for the full write-up of how cost
calibration, the refresh strategy, and quota windows are computed under the
hood.

## License

[MIT](LICENSE)
