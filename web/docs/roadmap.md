# Fantasy F1 App — Roadmap

## Purpose

Build a full-featured Fantasy Formula 1 web app that lets users create and join leagues, manage teams within a budget, select driver/constructor lineups weekly, make transfers, and track scoring and leaderboards.

AI-powered recommendations will be added later (v3.0) but are **not** part of the MVP. A user can only
have a single team, but can join multiple leagues.

## Tech Stack

**Frontend:** React 19 (TSX) + Vite, Tailwind CSS, shadcn/ui, Zustand or Context  
**Backend:** .NET Core Minimal APIs (REST)  
**Auth/DB:** Supabase (Auth + Postgres + RLS)  
**Infra:** Netlify (frontend), Render (backend), CI/CD via GitHub Actions  
**Observability:** Sentry/LogRocket (frontend), OpenTelemetry + Sentry (backend)  
**Background jobs:** Supabase Edge Functions or hosted cron

---

## Version Roadmap

### MVP (v0.1–v0.3): Core Salary-Cap Fantasy

**Features**

- Auth via Supabase (email/password)
- Season & Grand Prix schedule
- League creation (public/private), join via code
- Budgets, price list for drivers/constructors
- Driver and Constructor prices change based on performance of each race weekend
- Team management: 5 drivers & 2 constructors under $100m budget
- Weekly lock before race
- Scoring engine
- Leaderboards (weekly + season totals)
- Commissioner tools (settings, invite reset)
- RLS enforcement in DB
- Audit logs for lineup changes and scoring

**Success Criteria**

- Create league → join → pick team → lock → ingest results → compute → leaderboard
- Scoring and budgets are deterministic, reproducible, and auditable

---

### v1.0: Quality + Automation

- Automated results ingestion from provider/API
- Scheduled price updates based on performance rules
- Weekly trade caps and penalties
- Email notifications (locks, results)
- User profiles with display names and avatars
- League commissioner bulk tools
- Server-side caching for hot reads

---

### v1.1: UX Depth + Admin

- Timeline/activity feed in leagues
- What-if lineup simulator (non-AI)
- Internationalization-ready copy and currency formatting

---

### v2.0: Advanced League Options

- Custom scoring templates with safe overrides
- Chips/streaks (e.g., double points) with audit logging
- Head-to-head matchups within leagues

---

### v3.0: AI Recommendation Suite

- Recommendation engine with strategy modes
- Explainable reasoning for picks
- Model Context Protocol (MCP) for league-specific rules/preferences
- Opt-in privacy controls

---

## High-Level Architecture

### Frontend

- State management: Zustand
- UI components: shadcn/ui + Tailwind
- Routing: React Router
- Data fetching: fetch wrapper with auth token injection
- Feature slices: `auth/`, `leagues/`, `teams/`, `lineups/`, `scoring/`, `results/`, `admin/`

### Backend

- Layers: Endpoints → Services → Repositories → DTOs
- Auth middleware for Supabase JWT verification
- Jobs: results ingestion + scoring
- Optional caching in v1.0+

### Database (Supabase/Postgres)

**Core tables:**

- `users`, `profiles`
- `seasons`, `grands_prix`
- `drivers`, `constructors`
- `prices`
- `leagues`, `league_members`
- `teams`, `rosters`
- `trades`
- `scoring_rules`
- `results_raw`, `results_normalized`
- `points`
- `leaderboards`
- `audit_logs`

Indexes, constraints, and RLS policies enforce data integrity and access control.

---

## API Shape (REST)

**Examples:**

- `GET /me` — current profile
- `POST /leagues` — create league
- `GET /leagues/{id}/leaderboard` — standings
- `PUT /teams/{id}/lineup` — update lineup
- `POST /admin/results/upload` — commissioner results entry
- `POST /admin/scoring/run` — compute points

---

## Scoring Engine Principles

- Pure deterministic function per team per GP
- Inputs: normalized quali/race results, penalties, DNS/DNF flags
- Store raw inputs and rule version used
- Recompute idempotently for audits

---

## Data Ingestion

- MVP: Manual CSV/JSON upload
- v1.0: Automated ingestion with fallback to manual

---

## Security

- Supabase JWT verification for all endpoints
- RLS in Postgres for data security
- Lock enforcement at DB and API layers
- Minimal PII storage, secure logging

---

## Testing

- Backend: Unit tests for scoring, integration tests for endpoints
- Frontend: Component + E2E tests for critical flows
- Load tests for leaderboards and pricing endpoints

---

## Delivery Roadmap Summary

**v0.1** — Auth, league creation/join, lineup editor, manual results & scoring  
**v0.2** — Trades, lock enforcement, activity feed, exports  
**v0.3** — Observability, caching, commissioner overrides  
**v1.0** — Automation (results/prices), notifications, profile polish  
**v1.1** — What-if simulator, co-commissioners, i18n groundwork  
**v2.0** — Advanced scoring, chips, head-to-head  
**v3.0** — AI recommendations & explainability

---

## Conventions

- TypeScript strict mode
- Conventional commits
- API versioning via `/api/v1`
- Environment-based config (no secrets in repo)
- Accessibility compliance
