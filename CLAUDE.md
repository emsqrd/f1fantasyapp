# F1 Fantasy App Monorepo

Full-stack F1 Fantasy Sports application combining React frontend and .NET backend.

## Repository Structure

- `web/` - React/TypeScript frontend with Vite (see web/CLAUDE.md)
- `api/` - .NET 9 ASP.NET Core API backend (see api/CLAUDE.md)

## Quick Start

### Development

```bash
# Install frontend dependencies
npm run web:install

# Start both servers (in separate terminals)
npm run web:dev      # Frontend at http://localhost:5173
npm run api:watch    # API with hot reload

# Or use VSCode tasks: "Start All Servers"
```

### Testing

```bash
# Run all tests
npm run test:all

# Individual projects
npm run web:test
npm run api:test
```

### Building

```bash
# Build frontend
npm run web:build

# Build API
npm run api:build
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

## Project Documentation

- `web/CLAUDE.md` - Frontend architecture, patterns, and conventions
- `api/CLAUDE.md` - Backend architecture, patterns, and conventions
