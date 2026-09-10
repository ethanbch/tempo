# Tempo

A local dashboard for your Claude Code usage: API-equivalent cost, tokens,
cache efficiency, quota windows, and a breakdown by model and by project.

Built for **Claude Pro and Max** subscribers.

*(Lire ce document [en français](README.md).)*

## Everything runs on your machine

Tempo is a small Next.js app you run on `localhost`. There's no login screen,
no account to create, and no data ever leaves your computer:

- It reads the transcripts Claude Code already writes locally at
  `~/.claude/projects/**/*.jsonl`.
- It reads your account info from `~/.claude.json`, the config file Claude
  Code itself maintains.
- The only network request involved is your browser talking to the local
  server on your own machine. Nothing is sent anywhere else.

This also means Tempo only covers **Claude Code** usage — not conversations on
claude.ai, which don't leave any local trace. And why local in the first
place: there's no public "Sign in with Claude" OAuth for individual claude.ai
accounts, and Anthropic's usage/cost APIs are reserved for organizations
(Admin or Analytics keys) — a Pro or Max subscription doesn't get access to
them. Your local transcripts are the only real source of truth available.

## How to run it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`. The dashboard refreshes automatically
every 30 seconds while the tab is visible.

## What it shows

- **Cost**: what the same usage would have cost at public API rates (Pro/Max
  isn't billed per token, so this measures value consumed, not an actual
  bill).
- **Quota windows**: your Claude usage replayed against the 5-hour rolling
  window rule, so you can see your busiest windows.
- **Optimization levers**: cache rewritten after a session resumes past its
  1-hour expiry, cache invalidated by switching model/effort mid-session,
  context growing past a comfortable size, effort level, and model mix.

See [README.md](README.md) (in French) for the full write-up of how the cost
calibration, refresh strategy, and quota windows are computed.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `CLAUDE_PROJECTS_PATH` | `~/.claude/projects` | Where transcripts are read from |
| `CLAUDE_CONFIG_PATH` | `~/.claude.json` | Where the account info is read from |
