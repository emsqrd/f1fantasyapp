# F1 Companion Monorepo Migration Plan

## Overview

This document outlines the migration plan for consolidating `f1-companion` (React frontend) and `f1-companion-api` (.NET backend) into a single monorepo using a "simple monorepo" approach.

### Why Monorepo?

**Primary Goal:** Unified branch and PR management for features that span both frontend and API.

**Additional Benefits:**
- Atomic commits across both projects
- Unified search and git history
- Single PR with full context for reviewers
- Easier coordinated refactoring
- Single issue tracker and project management

### Why "Simple" Monorepo?

This approach uses a single git repository with both projects as subdirectories, without heavyweight monorepo tools like Turborepo or npm workspaces. This is appropriate because:

- Only two projects (not dozens)
- Different languages (TypeScript + C#) - no shared code
- Solo developer - no complex team coordination needed
- Already using VSCode workspace with both projects

The "simple" approach gives you the main benefit (unified branches/PRs) without the complexity of polyglot monorepo tooling.

---

## New Repository Structure

```
f1-companion-mono/
├── .github/
│   └── workflows/
│       └── api-deploy.yml          # Azure deployment (path-filtered)
├── .husky/
│   └── pre-commit                  # Root-level git hooks
├── .vscode/
│   ├── tasks.json                  # VSCode tasks (dev servers, builds, tests)
│   ├── launch.json                 # Debug configurations
│   ├── settings.json               # Workspace settings
│   └── extensions.json             # Recommended extensions
├── web/                            # Frontend (current f1-companion)
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   ├── CLAUDE.md
│   └── ...
├── api/                            # Backend (current f1-companion-api)
│   ├── F1CompanionApi/
│   ├── F1CompanionApi.UnitTests/
│   ├── f1-companion-api.sln
│   ├── CLAUDE.md
│   └── ...
├── package.json                    # Root package.json (for husky + convenience scripts)
├── .gitignore                      # Combined gitignore
├── CLAUDE.md                       # Root-level project overview
└── README.md                       # Project documentation
```

---

## Migration Steps

### Prerequisites

- Both existing repos should be in a clean state (committed changes)
- Ensure all important work is pushed to remote
- Have `rsync` available (standard on macOS)

**Estimated Total Time:** 50-60 minutes

---

### Step 1: Create Monorepo Directory (5 min)

```bash
cd ~/git

# Create new monorepo directory
mkdir f1-companion-mono
cd f1-companion-mono

# Initialize git
git init

# Create project directories
mkdir web api
```

---

### Step 2: Copy Project Files (10 min)

Copy files from both repos, excluding git history and build artifacts:

```bash
# Copy frontend (excluding .git, node_modules, dist)
rsync -av \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='coverage' \
  ~/git/f1-companion/ \
  ~/git/f1-companion-mono/web/

# Copy API (excluding .git, node_modules, bin, obj)
rsync -av \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='bin' \
  --exclude='obj' \
  --exclude='coverage' \
  --exclude='TestResults' \
  ~/git/f1-companion-api/ \
  ~/git/f1-companion-mono/api/
```

**Verify:**
```bash
# Check that files were copied
ls -la web/
ls -la api/
```

---

### Step 3: Remove Individual Husky Setups (5 min)

Husky will be managed at the root level only:

```bash
cd ~/git/f1-companion-mono

# Remove husky from each project
rm -rf web/.husky
rm -rf api/.husky

# Remove husky from web package.json devDependencies
cd web
npm pkg delete devDependencies.husky

# Remove API's package.json (only used for Husky)
cd ../api
rm -f package.json package-lock.json
```

---

### Step 4: Create Root Configuration Files (15 min)

#### 4.1 Root `package.json`

```bash
cd ~/git/f1-companion-mono
```

Create `package.json`:

```json
{
  "name": "f1-companion-mono",
  "version": "1.0.0",
  "description": "F1 Fantasy Sports - Full Stack Monorepo",
  "private": true,
  "scripts": {
    "web:install": "cd web && npm install",
    "web:dev": "cd web && npm run dev",
    "web:build": "cd web && npm run build",
    "web:lint": "cd web && npm run lint",
    "web:test": "cd web && npm test",
    "web:test:watch": "cd web && npm run test:watch",
    "web:coverage": "cd web && npm run test:coverage",
    "api:build": "dotnet build api/F1CompanionApi/F1CompanionApi.csproj",
    "api:run": "dotnet run --project api/F1CompanionApi/F1CompanionApi.csproj",
    "api:watch": "dotnet watch run --project api/F1CompanionApi/F1CompanionApi.csproj",
    "api:test": "dotnet test api/F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj",
    "test:all": "npm run web:test && npm run api:test",
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "^9.1.7"
  }
}
```

#### 4.2 Root `.gitignore`

Create `.gitignore`:

```gitignore
# === Shared ===
.DS_Store
node_modules/
coverage/
*.log
logs/
.env
.env.local

# === Web (React/Vite) ===
web/dist/
web/dist-ssr/
web/*.local
web/.vscode/*
!web/.vscode/extensions.json

# === API (.NET) ===
api/**/[Bb]in/
api/**/[Oo]bj/
api/**/[Dd]ebug/
api/**/[Rr]elease/
api/**/artifacts/
api/**/*.nupkg
api/**/*.snupkg
api/**/*.binlog
api/**/TestResults/
api/**/CodeCoverage/

# Editor
.idea/
*.suo
*.ntvs*
*.njsproj
*.sw?
```

#### 4.3 Root `CLAUDE.md`

Create `CLAUDE.md`:

```markdown
# F1 Companion Monorepo

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
```

---

### Step 5: Set Up Husky at Root (10 min)

```bash
cd ~/git/f1-companion-mono

# Install dependencies (includes husky)
npm install

# Initialize husky
npx husky init
```

Create `.husky/pre-commit`:

```bash
#!/bin/sh

echo "🔨 Running pre-commit checks..."

echo ""
echo "📦 Web: Building..."
npm run web:build || exit 1

echo ""
echo "🔍 Web: Linting..."
npm run web:lint || exit 1

echo ""
echo "🧪 Web: Testing..."
npm run web:test || exit 1

echo ""
echo "🧪 API: Testing..."
npm run api:test || exit 1

echo ""
echo "✅ All checks passed!"
```

Make it executable:

```bash
chmod +x .husky/pre-commit
```

---

### Step 6: Create VSCode Configuration (10 min)

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "[Web] Dev Server",
      "type": "shell",
      "command": "npm run dev",
      "options": {
        "cwd": "${workspaceFolder}/web"
      },
      "isBackground": true,
      "problemMatcher": {
        "pattern": {
          "regexp": "^([^\\s].*)\\((\\d+|\\d+,\\d+|\\d+,\\d+,\\d+,\\d+)\\):\\s+(error|warning|info)\\s+(TS\\d+)\\s*:\\s*(.*)$",
          "file": 1,
          "location": 2,
          "severity": 3,
          "code": 4,
          "message": 5
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "VITE.*ready in",
          "endsPattern": "Local:.*"
        }
      },
      "icon": {
        "id": "rocket",
        "color": "terminal.ansiCyan"
      }
    },
    {
      "label": "[Web] Test Watch",
      "type": "shell",
      "command": "npm run test:watch",
      "options": {
        "cwd": "${workspaceFolder}/web"
      },
      "isBackground": true,
      "problemMatcher": [],
      "icon": {
        "id": "beaker",
        "color": "terminal.ansiCyan"
      }
    },
    {
      "label": "[Web] Build",
      "type": "shell",
      "command": "npm run build",
      "options": {
        "cwd": "${workspaceFolder}/web"
      },
      "problemMatcher": ["$tsc"],
      "group": {
        "kind": "build",
        "isDefault": false
      },
      "icon": {
        "id": "package",
        "color": "terminal.ansiCyan"
      }
    },
    {
      "label": "[Web] Lint",
      "type": "shell",
      "command": "npm run lint",
      "options": {
        "cwd": "${workspaceFolder}/web"
      },
      "problemMatcher": ["$eslint-stylish"],
      "icon": {
        "id": "checklist",
        "color": "terminal.ansiCyan"
      }
    },
    {
      "label": "[API] Watch",
      "type": "shell",
      "command": "dotnet watch run",
      "options": {
        "cwd": "${workspaceFolder}/api/F1CompanionApi"
      },
      "isBackground": true,
      "problemMatcher": {
        "pattern": {
          "regexp": "^(.*)$",
          "file": 1
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": "^.*Building.*$",
          "endsPattern": "^.*Application started.*|^.*Now listening on.*$"
        }
      },
      "icon": {
        "id": "eye-watch",
        "color": "terminal.ansiMagenta"
      }
    },
    {
      "label": "[API] Build",
      "type": "shell",
      "command": "dotnet build",
      "options": {
        "cwd": "${workspaceFolder}/api/F1CompanionApi"
      },
      "problemMatcher": ["$msCompile"],
      "group": {
        "kind": "build",
        "isDefault": false
      },
      "icon": {
        "id": "package",
        "color": "terminal.ansiMagenta"
      }
    },
    {
      "label": "[API] Test",
      "type": "shell",
      "command": "dotnet test",
      "options": {
        "cwd": "${workspaceFolder}/api/F1CompanionApi.UnitTests"
      },
      "problemMatcher": ["$msCompile"],
      "icon": {
        "id": "beaker",
        "color": "terminal.ansiMagenta"
      }
    },
    {
      "label": "Start All Servers",
      "dependsOn": ["[Web] Dev Server", "[API] Watch"],
      "dependsOrder": "parallel",
      "problemMatcher": [],
      "icon": {
        "id": "rocket",
        "color": "terminal.ansiGreen"
      }
    },
    {
      "label": "Build All",
      "dependsOn": ["[Web] Build", "[API] Build"],
      "dependsOrder": "parallel",
      "problemMatcher": [],
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "icon": {
        "id": "package",
        "color": "terminal.ansiGreen"
      }
    }
  ]
}
```

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Web: Chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/web",
      "preLaunchTask": "[Web] Dev Server"
    },
    {
      "name": "API: .NET Launch",
      "type": "coreclr",
      "request": "launch",
      "preLaunchTask": "[API] Build",
      "program": "${workspaceFolder}/api/F1CompanionApi/bin/Debug/net9.0/F1CompanionApi.dll",
      "args": [],
      "cwd": "${workspaceFolder}/api/F1CompanionApi",
      "stopAtEntry": false,
      "serverReadyAction": {
        "action": "openExternally",
        "pattern": "\\bNow listening on:\\s+(https?://\\S+)"
      },
      "env": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    },
    {
      "name": "API: .NET Attach",
      "type": "coreclr",
      "request": "attach"
    }
  ],
  "compounds": [
    {
      "name": "Full Stack (Web + API)",
      "configurations": ["Web: Chrome", "API: .NET Launch"],
      "stopAll": true,
      "presentation": {
        "hidden": false,
        "group": "fullstack",
        "order": 1
      }
    }
  ]
}
```

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/bin": true,
    "**/obj": true,
    "**/.git": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/bin": true,
    "**/obj": true,
    "**/coverage": true,
    "**/.git": true
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[csharp]": {
    "editor.defaultFormatter": "ms-dotnettools.csharp"
  },
  "cSpell.words": [
    "COTA",
    "dotnet",
    "refetches",
    "supabase",
    "vite",
    "vitest"
  ]
}
```

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "vitest.explorer",
    "ms-dotnettools.csharp",
    "ms-dotnettools.csdevkit",
    "ms-dotnettools.vscode-dotnet-runtime",
    "eamodio.gitlens"
  ]
}
```

---

### Step 7: Update CI/CD Workflow (10 min)

```bash
# Create GitHub workflows directory
mkdir -p .github/workflows

# Copy and rename API deployment workflow
cp api/.github/workflows/*.yml .github/workflows/api-deploy.yml

# Remove old workflows directory
rm -rf api/.github
```

Update `.github/workflows/api-deploy.yml`:

```yaml
name: Deploy API to Azure

on:
  push:
    branches: [main]
    paths:
      - 'api/**'
      - '.github/workflows/api-deploy.yml'
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - name: Checkout to the branch
        uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.F1FANTASYAPP_AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.F1FANTASYAPP_AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.F1FANTASYAPP_AZURE_SUBSCRIPTION_ID }}

      - name: Build and push container image to registry
        uses: azure/container-apps-deploy-action@v2
        with:
          appSourcePath: ${{ github.workspace }}/api
          registryUrl:
          registryUsername: ${{ secrets.F1FANTASYAPP_REGISTRY_USERNAME }}
          registryPassword: ${{ secrets.F1FANTASYAPP_REGISTRY_PASSWORD }}
          containerAppName: f1fantasyapp
          resourceGroup: F1FantasyApp
          imageToBuild: default/f1fantasyapp:${{ github.sha }}
```

**Key changes:**
- Path filter: `'api/**'` ensures workflow only runs on API changes
- Updated `appSourcePath` to point to `api/` subdirectory
- Updated to `actions/checkout@v4`

---

### Step 8: Verification & Testing (10 min)

```bash
cd ~/git/f1-companion-mono

# Install web dependencies
npm run web:install

# Verify builds work
echo "Testing web build..."
npm run web:build

echo "Testing API build..."
npm run api:build

# Verify tests work
echo "Running web tests..."
npm run web:test

echo "Running API tests..."
npm run api:test

# Test husky pre-commit hook
echo "Testing pre-commit hook..."
git add .
git commit -m "test: verify pre-commit hook" --no-verify
git reset HEAD~1
```

**Manual verification:**
1. Open folder in VSCode: `code .`
2. Run "Start All Servers" task (Cmd+Shift+P → Tasks: Run Task)
3. Verify frontend loads at http://localhost:5173
4. Verify API is accessible
5. Test the "Full Stack (Web + API)" debug configuration

---

### Step 9: Initial Commit & Push (5 min)

```bash
cd ~/git/f1-companion-mono

# Initial commit
git add .
git commit -m "Initial monorepo setup

- Migrated f1-companion (frontend) to web/
- Migrated f1-companion-api (backend) to api/
- Configured root-level Husky for pre-commit checks
- Added VSCode tasks, launch configs, and settings
- Updated CI/CD workflow for API deployment with path filtering"

# Create GitHub repo and push
gh repo create f1-companion-mono --private --source=. --push

# Or push to existing remote
# git remote add origin git@github.com:yourusername/f1-companion-mono.git
# git push -u origin main
```

---

### Step 10: Update GitHub Secrets (5 min)

Copy existing secrets from `f1-companion-api` to the new `f1-companion-mono` repo:

```bash
# List existing secrets (for reference)
gh secret list --repo yourusername/f1-companion-api

# Copy secrets to new repo
gh secret set F1FANTASYAPP_AZURE_CLIENT_ID --repo yourusername/f1-companion-mono
gh secret set F1FANTASYAPP_AZURE_TENANT_ID --repo yourusername/f1-companion-mono
gh secret set F1FANTASYAPP_AZURE_SUBSCRIPTION_ID --repo yourusername/f1-companion-mono
gh secret set F1FANTASYAPP_REGISTRY_USERNAME --repo yourusername/f1-companion-mono
gh secret set F1FANTASYAPP_REGISTRY_PASSWORD --repo yourusername/f1-companion-mono
```

Or copy via GitHub web UI: Settings → Secrets and variables → Actions

---

## Post-Migration Tasks

### Update Local Development

1. **Update .env files** if they reference old paths
2. **Update any local scripts** that referenced old repo paths
3. **Update VS Code workspace** (if you keep the old one for reference, update paths)

### Update Documentation

1. Update README in both `web/` and `api/` if they reference repo structure
2. Update any external documentation referencing the repos

### Notify Team (if applicable)

If you have collaborators:
1. Announce the migration
2. Share new clone instructions
3. Archive old repos (don't delete immediately)

---

## Rollback Plan

If something goes wrong, your original repos are untouched:

```bash
# Original repos remain at:
~/git/f1-companion/
~/git/f1-companion-api/

# Simply delete the monorepo and continue with separate repos
rm -rf ~/git/f1-companion-mono
```

Consider keeping the old repos around for 1-2 weeks after migration before archiving them.

---

## Advantages Summary

| Benefit | Description |
|---------|-------------|
| **Unified branch/PR** | Single branch and PR for features spanning both frontend and API |
| **Atomic commits** | One commit captures changes to both projects with clear relationship |
| **Unified search** | Search across entire codebase at once |
| **Simpler git workflow** | No need to keep two repos in sync or coordinate branch names |
| **Single issue tracker** | All issues in one place with full context |
| **Easier code review** | Reviewer sees both API changes and how frontend consumes them |
| **One git clone** | New contributors clone once, see the whole system |

---

## Disadvantages to Consider

| Disadvantage | Impact | Reality Check |
|--------------|--------|---------------|
| **Larger git clone** | ~2x size | For personal project, negligible impact |
| **Noisier git history** | Both projects interleaved | Use `git log -- web/` or `git log -- api/` to filter |
| **Lose individual repo history** | Fresh start approach | History still exists in original repos if needed |

---

## Questions or Issues?

If you encounter problems during migration:

1. Check that both original repos are in clean state
2. Verify all paths in configuration files match new structure
3. Ensure GitHub secrets are copied correctly
4. Test CI/CD with a small change to `api/` directory

Remember: Your original repos remain untouched until you're confident in the monorepo setup.
