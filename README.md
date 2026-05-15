# F1 Fantasy App

Full-stack F1 Fantasy Sports platform where users build fantasy F1 teams, join leagues, and compete based on real race performance.

## Tech Stack

### Frontend (`web/`)

- React 19 + TypeScript
- TanStack Router (type-safe routing)
- Tailwind CSS v4
- Supabase Auth
- Vite + Vitest

### Backend (`api/`)

- .NET 10 ASP.NET Core Minimal API
- Entity Framework Core
- PostgreSQL (local via Supabase CLI; Supabase hosted in prod)
- xUnit (unit) + Testcontainers Postgres (integration)

### E2E (`e2e/`)

- Playwright against a prod-like web + API build, backed by a dedicated local Supabase stack

## Getting Started

### Prerequisites

- Node.js (see `.nvmrc`)
- .NET 10 SDK
- Docker Desktop
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- `dotnet-ef` tool (`dotnet tool install --global dotnet-ef`)

### Setup

1. **Install frontend dependencies**

   ```bash
   npm run web:install
   ```

2. **Start the local Supabase dev stack**

   ```bash
   cd api && supabase start
   ```

   Keep the output — `supabase status` reprints it. `API URL`, `anon key`, and `JWT secret` feed into step 3.

3. **Configure environment**

   `web/.env.local`:

   ```
   VITE_SUPABASE_URL=<API URL from supabase status>
   VITE_SUPABASE_ANON_KEY=<anon key from supabase status>
   VITE_F1_FANTASY_API=http://localhost:5077/api
   ```

   API: see `api/README.md` for `appsettings.Development.json` / user-secrets setup (`ConnectionStrings:DefaultConnection`, `Supabase:JwtSecret`).

4. **Apply backend migrations**

   ```bash
   cd api && dotnet ef database update --project F1CompanionApi
   ```

5. **Start dev servers**

   ```bash
   npm run web:dev      # Frontend: http://localhost:5173
   npm run api:watch    # API:      http://localhost:5077
   ```

### Development Scripts

```bash
# Frontend
npm run web:dev                # Start dev server
npm run web:build              # Production build
npm run web:test               # Unit + component tests
npm run web:test:watch         # Tests in watch mode
npm run web:coverage           # Coverage report
npm run web:lint               # ESLint
npm run web:format             # Prettier (write)
npm run web:format:check       # Prettier (check)

# Backend
npm run api:watch              # Run with hot reload
npm run api:build              # Build project
npm run api:test               # Unit + integration
npm run api:test:unit          # Unit tests only
npm run api:test:integration   # Integration tests (Testcontainers; Docker required)
npm run api:format             # dotnet format + csharpier
npm run api:format:check       # Format check (CI)

# E2E
npm run e2e:install            # Install Playwright deps + Chromium (run once)
npm run e2e                    # Run E2E suite (requires `cd e2e/supabase && supabase start` first)
npm run e2e:ui                 # Playwright UI mode

# All
npm run test:all               # Frontend + backend (unit + integration). Does not run e2e.
```

## Local Services Topology

Two Supabase CLI stacks and two sets of web/API servers coexist on one machine so dev work and the e2e suite never touch the same state.

| Stack | Config          | Supabase ports (API/DB/Studio/Mailpit) | Web port | API port |
| ----- | --------------- | --------------------------------------- | -------- | -------- |
| Dev   | `api/supabase/` | `54321 / 54322 / 54323 / 54324`         | `5173`   | `5077`   |
| E2E   | `e2e/supabase/` | `54421 / 54422 / 54423 / 54424`         | `5273`   | `5177`   |

**Port-shift rule:** everything e2e-owned is `dev + 100`. Applies to Supabase ports, `vite preview`, and the published .NET API. Lets `npm run web:dev` and `npm run api:watch` keep running while `npm run e2e` fires.

**Migration sharing:** `e2e/supabase/migrations/` is a symlink to `api/supabase/migrations/`, so both stacks apply the same storage-bucket and profile-trigger migrations verbatim. A drift check at `e2e/tests/_infra/config-sync.spec.ts` fails loudly if the two `config.toml` files diverge on anything other than ports / `project_id`.

**Database scope:** each stack uses its own `postgres` database end-to-end — `public.*` (app data), `auth.*` (GoTrue), and `storage.*` (Supabase Storage) share one DB per stack, prod-faithful.

## VSCode Integration

- **Tasks**: Cmd+Shift+P → "Tasks: Run Task" → "Start All Servers"
- **Debugging**: F5 → "Full Stack (Web + API)"

## Project Structure

```
f1fantasyapp/
├── web/                              # React frontend
├── api/
│   ├── F1CompanionApi/               # .NET backend
│   ├── F1CompanionApi.UnitTests/
│   ├── F1CompanionApi.IntegrationTests/
│   └── supabase/                     # Dev Supabase CLI project
├── e2e/                              # Playwright E2E suite
│   └── supabase/                     # E2E Supabase CLI project (ports +100)
├── docs/
│   ├── adr/
│   ├── mockups/
│   ├── plans/
│   └── research/
├── .github/workflows/
├── .vscode/
└── package.json
```

## Documentation

- [Frontend](web/CLAUDE.md) — React architecture, patterns, testing
- [Backend](api/CLAUDE.md) — .NET architecture, services, testing
- [Backend integration tests](api/F1CompanionApi.IntegrationTests/README.md) — fixture lifecycle, auth helpers
- [E2E suite](e2e/README.md) — prerequisites, conventions, selector discipline
- [Fantasy game rules](docs/research/fantasy-rules/decisions/) — game-design source of truth: what the app is built to implement
- [Architecture decision records](docs/adr/) — software decisions worth preserving context for
- [Implementation plans](docs/plans/) — feature plans written during plan mode

## Contributing

This is a personal project, but feedback and suggestions are welcome via issues.

## License

Private - All Rights Reserved
