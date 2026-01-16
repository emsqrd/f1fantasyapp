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
- .NET 9 ASP.NET Core
- Entity Framework Core
- PostgreSQL
- Supabase JWT Authentication
- xUnit Testing

## Getting Started

### Prerequisites
- Node.js 18+
- .NET 9 SDK
- PostgreSQL (or Supabase account)

### Setup

1. **Install frontend dependencies**
   ```bash
   npm run web:install
   ```

2. **Configure environment variables**

   Create `web/.env.local`:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_F1_FANTASY_API=your_api_base_url
   VITE_SENTRY_DSN=your_sentry_dsn
   ```

   Create `api/F1CompanionApi/appsettings.Development.json` (see api/README.md)

3. **Start development servers**
   ```bash
   npm run web:dev      # Frontend: http://localhost:5173
   npm run api:watch    # API with hot reload
   ```

### Development Scripts

```bash
# Frontend
npm run web:dev          # Start dev server
npm run web:build        # Production build
npm run web:test         # Run tests
npm run web:lint         # Run linter

# Backend
npm run api:watch        # Run with hot reload
npm run api:build        # Build project
npm run api:test         # Run unit tests

# All
npm run test:all         # Run all tests
```

## VSCode Integration

This repo is optimized for VSCode:
- **Tasks**: Cmd+Shift+P → "Tasks: Run Task" → "Start All Servers"
- **Debugging**: F5 → "Full Stack (Web + API)"

## Project Structure

```
f1fantasyapp/
├── web/                 # React frontend
│   ├── src/
│   ├── CLAUDE.md        # Frontend architecture guide
│   └── package.json
├── api/                 # .NET backend
│   ├── F1CompanionApi/
│   ├── F1CompanionApi.UnitTests/
│   ├── CLAUDE.md        # Backend architecture guide
│   └── f1-companion-api.sln
├── .github/
│   └── workflows/       # CI/CD pipelines
├── .vscode/             # VSCode tasks and debug configs
└── package.json         # Root workspace scripts
```

## Documentation

- [Frontend Documentation](web/CLAUDE.md) - React architecture, patterns, testing
- [Backend Documentation](api/CLAUDE.md) - .NET architecture, services, testing
- [Migration Plan](web/docs/MONOREPO_MIGRATION_PLAN.md) - Monorepo setup details

## Contributing

This is a personal project, but feedback and suggestions are welcome via issues.

## License

Private - All Rights Reserved
