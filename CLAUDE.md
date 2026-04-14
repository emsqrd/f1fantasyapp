# F1 Fantasy App Monorepo

Full-stack F1 Fantasy Sports application combining React frontend and .NET backend.

## System Overview

F1 Fantasy Sports platform where users build fantasy F1 teams, join leagues, and earn points based on real race performance.

**Architecture:**

```
React SPA (Vite) → .NET 9 Minimal API → PostgreSQL
                ↓
            Supabase Auth
```

**Tech Stack:**

- **Frontend:** React 19, TypeScript, TanStack Router, Tailwind CSS v4, shadcn/ui
- **Backend:** .NET 9 ASP.NET Core Minimal API, Entity Framework Core
- **Database:** PostgreSQL
- **Services:** Supabase (authentication), Sentry (monitoring)

## Domain & Features

### Core Concepts

- **Team** — Each user creates one team per season. Teams are subject to a budget cap; each driver/constructor has a price and the projected spend cannot exceed the cap.
- **Roster Lock** — Each race has a `LockDeadline`. Once `now >= lockDeadline`, the team can no longer be modified (drivers/constructors cannot be added or removed). The UI shows a live countdown and disables pickers when locked.
- **League** — Users create or join leagues to compete against others. Public leagues are browsable; private leagues use invite tokens. Max 15 teams per league. A team can belong to multiple leagues.
- **Scoring** — Teams earn points based on real F1 race results. See `docs/research/fantasy-rules/decisions/scoring.md` for the rules.
- **Season / Race** — Seasons map to F1 calendar years and contain ordered races (with round numbers and lock deadlines). Driver and constructor pricing is dynamic per season.

## F1 Domain

**Grid:** 22 drivers across 11 constructors. Each constructor fields exactly 2 drivers.

**Race weekends** come in two formats as it pertains to this game:

- **Standard:** Qualifying → Race
- **Sprint** (~6 per season): Sprint → Qualifying → Race

**Game rules and design decisions** are documented in `docs/research/fantasy-rules/decisions/`:

- `design-goals.md` — Player experience goals that all other decisions are evaluated against
- `format.md` — Team shape: slot counts, budget cap, composition constraints
- `rules.md` — Gameplay mechanics: transfers, captain, locking, budget, edge cases
- `scoring.md` — Point tables and scoring logic (intentionally diverges from official F1 Fantasy)
- `pricing.md` — Preseason pricing source, in-season PPM-based price movement formula

The official F1 Fantasy scoring rules are captured for reference in `docs/research/fantasy-rules/reference/f1-official-scoring.md`.

## Project Context

- **Team Size**: Solo developer
- **Development Philosophy**: Balance simplicity with proper patterns - avoid both over-engineering for scale and shortcuts that create technical debt
- **F1 Season**: The F1 season aligns with the calendar year. When referencing teams, drivers, regulations, or example data, use the current season's information first, falling back to the previous season only when current-season data isn't available.

## Claude Code Preferences

- Avoid over-engineering; keep solutions focused on the requested task
- Adhere to YAGNI philosophy
- When in doubt about approach, ask rather than proceed
- Keep solutions focused on solving the cause of a problem, not the symptom
- Use conventional commit styling for commit messages

## Feature Planning

When planning features (via plan mode or when asked to plan), organize the plan into a sequence of **self-contained commits**. Each commit is a gate — wait for user approval before moving to the next one.

- Each commit includes **both functionality and its tests** — never split implementation from tests.
- Each commit must independently pass build, lint, tests, and formatting.
- Commits should be iterative and incremental — each builds on the last.
- Order commits so earlier ones lay the foundation (e.g., data model before API before frontend).
- Keep commits focused. If a commit is doing too much, split it further.
- Write the plan to `docs/plans/` when producing a full plan.

## Git Commit Message Preferences

- Do not include the "Generated with Claude Code" footer in commit messages or PR descriptions

## Repository Structure

- `web/` - React/TypeScript frontend with Vite (see web/CLAUDE.md)
- `api/` - .NET 9 ASP.NET Core API backend (see api/CLAUDE.md)

## Quick Start

Always use `npm run <script>` from the repo root — never `npx`, `cd api && dotnet`, or `cd web && npm` directly.

### Development

```bash
npm run web:install  # Install frontend dependencies (run once)
npm run web:dev      # Frontend at http://localhost:5173
npm run api:watch    # API with hot reload (preferred over api:run)

# Or use VSCode tasks: "Start All Servers"
```

### Testing

```bash
npm run test:all          # Run all tests
npm run web:test          # Frontend tests
npm run web:test:watch    # Frontend tests in watch mode
npm run web:coverage      # Frontend test coverage
npm run api:test          # Backend tests
```

### Building

```bash
npm run web:build  # Build frontend
npm run api:build  # Build API
```

### Code Quality

```bash
npm run web:lint          # Lint frontend
npm run web:format        # Format frontend
npm run web:format:check  # Check frontend formatting (CI)
npm run api:format        # Format backend
npm run api:format:check  # Check backend formatting (CI)
```

## VSCode Integration

Open this folder in VSCode and use:

- **Tasks** (Cmd+Shift+P → "Tasks: Run Task")
  - "Start All Servers" - Launches both dev servers
  - "[Web] Dev Server" - Frontend only
  - "[API] Watch" - Backend only
  - "Build All" - Full build
- **Debugging** (F5)
  - "Full Stack (Web + API)" - Debug both simultaneously

## Production Infrastructure

Hosted on Fly.io + Supabase (free tier).

| Resource                | Identifier                            |
| ----------------------- | ------------------------------------- |
| Fly.io app name         | `f1fantasyapp`                        |
| Fly.io region           | `iad` (Virginia)                      |
| Supabase project ref    | `cfuccajsckqzecbfyqrv`                |
| Supabase direct DB host | `db.cfuccajsckqzecbfyqrv.supabase.co` |

**MCP servers available for investigation:**

- `fly logs -a f1fantasyapp` — runtime logs from the API
- `mcp__sentry__search_events` — error events (project slug: `f1-fantasy-api` or `f1-fantasy-web`, org: `emsqrd`, regionUrl: `https://us.sentry.io`)
- `mcp__supabase__get_logs` — Postgres and API gateway logs (service: `postgres` or `api`)

**Initial page load fires two concurrent requests:** `GET /api/me/profile` + `GET /api/me/team/`

## Project Documentation

- `web/CLAUDE.md` - Frontend architecture, patterns, and conventions
- `api/CLAUDE.md` - Backend architecture, patterns, and conventions
- `docs/research/` - Research findings and design specs
- `docs/mockups/` - Static HTML mockups (self-contained, design tokens from `web/src/index.css`)
- `docs/plans/` - Feature implementation plans (written during plan mode)
