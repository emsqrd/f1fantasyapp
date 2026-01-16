---
description: 'Main instructions for React 19 + TypeScript Vite application with Supabase authentication. Component-driven architecture with UI, business logic, and data services separation.'
applyTo: '**/*.{ts,tsx,jsx,js,json,css,html}'
---

# F1 Fantasy Sports

## Overview

This is a React 19 + TypeScript Vite application for F1 fantasy sports with Supabase authentication. The app follows a component-driven architecture with clear separation between UI, business logic, and data services.

## Specialized Guidelines

For detailed guidance on specific topics, refer to these specialized instruction files:

- **[Architecture & Design Patterns](instructions/architecture.md)** - Component patterns, routing, service layer, state management, and styling guidelines
- **[Testing Guidelines](instructions/testing.md)** - Testing philosophy, strategies, patterns, and best practices
- **[Sentry Integration](instructions/sentry.md)** - Error tracking, performance monitoring, and structured logging

## Quick Reference

### Core Technologies

- React 19 with TypeScript
- TanStack Router (type-safe routing)
- Supabase (authentication)
- Tailwind CSS v4
- Vitest + React Testing Library
- Zod + React Hook Form

### Essential Commands

```bash
npm run dev           # Start dev server (port 5173)
npm test             # Run tests once
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage reports
npm run lint         # Run ESLint
npm run build        # Build for production
```

### Path Aliases

- `@/` maps to `src/` directory
- Always use absolute imports: `import { Button } from '@/components/ui/button'`

## Core Principles

When working on this codebase:

1. **Type Safety First** - Leverage TypeScript fully
2. **Test Behavior, Not Implementation** - Focus on user-facing behavior
3. **Component Composition** - Build reusable, composable components
4. **Separation of Concerns** - Keep UI, business logic, and data access separate
5. **Modern React Patterns** - Use hooks and context for state management
