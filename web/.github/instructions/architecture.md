---
description: 'React application architecture and design patterns. Component composition, routing, service layer, state management, styling, and error handling guidelines.'
applyTo: '**/*.{ts,tsx,jsx,js}'
---

# Architecture & Design Patterns

## Overview

This is a React 19 + TypeScript Vite application for F1 fantasy sports with Supabase authentication. The app follows a component-driven architecture with clear separation between UI, business logic, and data services.

## Key Architectural Patterns

### Authentication Flow

- Uses Supabase auth with `AuthProvider` context wrapping the entire app in `main.tsx`
- Protected routes use `beforeLoad` guards in route definitions (`requireAuth`, `requireTeam`, `requireNoTeam`)
- Registration includes automatic profile creation via `userProfileService`
- Route guards throw `redirect()` to navigate away from unauthorized routes

### Routing Structure

- **TanStack Router** with code-based routing defined in `src/router.tsx`
- Uses layout routes with `beforeLoad` guards for declarative route protection
- Layout component wraps all routes via root route
- Route tree hierarchy: `rootRoute` → layout routes → page routes
- Landing page is public, dashboard/team pages require auth

### Service Layer

- API calls abstracted into service modules (`teamService.ts`, `driverService.ts`, etc.)
- Uses centralized `apiClient` utility from `@/lib/api` with consistent error handling
- API client handles base URL configuration from environment variables
- Consistent async/await pattern with typed return values
- Services return typed responses based on contracts in `src/contracts/`

### Component Composition

- Uses discriminated union props pattern (see `RoleCard.tsx`) for flexible component variants
- Separate content components for different states
- Custom hooks for business logic (e.g., `useSlots.ts` for slot management)

## Technology Stack

- **React 19** - Latest React features with TypeScript
- **TanStack Router** - Type-safe routing with data loading and route guards
- **Supabase** - Authentication and backend services
- **Tailwind CSS v4** - Styling with Vite plugin (not PostCSS-based)
- **Vitest** - Test runner with React Testing Library
- **Zod + React Hook Form** - Form validation and route params validation

## Component Patterns

### UI Components (shadcn/ui)

- Located in `src/components/ui/` - **never modified directly**
- Use `class-variance-authority` for variant styling (see `button.tsx`)
- Import via `@/components/ui/[component]`

### Business Components

#### Discriminated Unions

- Use TypeScript discriminated unions for component variants (see `RoleCard`)
- Props pattern: `variant: 'empty' | 'filled'` with conditional props

#### Composition

- Separate content components (`AddRoleCardContent`, `InfoRoleCardContent`) for different states
- Use `renderCardContent()` helper functions for complex conditional component logic

#### Custom Hooks

- Business logic in hooks like `useSlots.ts` for slot management
- Generic type constraint: `<T extends { id: number }>`

### Route Guards (beforeLoad)

Use `beforeLoad` guards in route definitions for declarative authentication and authorization:

```typescript
import { requireAuth, requireTeam } from '@/lib/route-guards';
import { createRoute, Outlet } from '@tanstack/react-router';

// Layout route with auth guard - all children inherit protection
const authenticatedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: async ({ context }) => await requireAuth(context),
  component: () => <Outlet />,
});

// Page route as child of layout - inherits auth protection
const leaguesRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: 'leagues',
  loader: async () => ({ leagues: await getMyLeagues() }),
  component: LeagueList,
});
```

Available guards in `@/lib/route-guards.ts`:

- `requireAuth` - Redirects to `/` if not authenticated
- `requireTeam` - Redirects to `/create-team` if user has no team
- `requireNoTeam` - Redirects to `/leagues` if user already has a team

## State Management Patterns

```typescript
// Route data access (TanStack Router)
import { Route } from '@tanstack/react-router';

// Preferred slot management pattern
const { slots, pool, add, remove } = useSlots(initialPool, initialSlots, 4);

// Auth state access
const { user, signIn, signOut, loading } = useAuth();

const { leagues } = Route.useLoaderData(); // Type-safe loader data
const { leagueId } = Route.useParams(); // Type-safe route params
const navigate = Route.useNavigate(); // Type-safe navigation
```

## Data Loading with Route Loaders

TanStack Router uses loader functions to fetch data before component renders, eliminating loading state management in components.

### Loader Pattern

```typescript
import { createRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';

// Zod schema for type-safe route params
const leagueIdParamsSchema = z.object({
  leagueId: z.coerce.number().int().positive(),
});

const leagueRoute = createRoute({
  getParentRoute: () => teamRequiredLayoutRoute,
  path: 'league/$leagueId',
  loader: async ({ params }) => {
    // Validate params with Zod
    const result = leagueIdParamsSchema.safeParse(params);
    if (!result.success) throw notFound({ routeId: ROUTE_ID });

    const league = await getLeagueById(result.data.leagueId);
    if (!league) throw notFound({ routeId: ROUTE_ID });

    return { league };
  },
  component: LeagueComponent,
  pendingComponent: LoadingSpinner,
  pendingMs: 200, // Show pending after 200ms to prevent flash
  staleTime: 10_000, // Consider fresh for 10 seconds
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
});
```

### Consuming Loader Data

```typescript
import { Route } from './router'; // Generated route type

function LeagueComponent() {
  // Type-safe access to loader data - no loading states needed
  const { league } = Route.useLoaderData();

  return <div>{league.name}</div>;
}
```

### Key Loader Concepts

- **Data loads before render** - No `useEffect` or loading state management
- **Type-safe params** - Zod schemas validate and coerce route parameters
- **SWR caching** - `staleTime` and `gcTime` prevent unnecessary refetches
- **Pending components** - Show loading UI during data fetch
- **Error handling** - Throw `notFound()` or errors caught by `errorComponent`

## Styling Guidelines

### Tailwind + shadcn/ui

- **Tailwind CSS v4** with `@tailwindcss/vite` plugin (not PostCSS-based)
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Custom variants defined with `cva()` (class-variance-authority)
- Mobile-first responsive design with breakpoint utilities
- Dark mode support via `next-themes` package

### Component Styling Patterns

```typescript
// Preferred class composition
<Button className={cn("custom-styles", conditionalClass && "additional-styles")} />

// Size formatting utilities
formatMillions(value) // For currency display
```

### Path Aliases

- `@/` maps to `src/` directory
- Always use absolute imports: `import { Button } from '@/components/ui/button'`

## Data Flow & Services

### Service Architecture

- Services handle all external API calls with consistent error handling
- Services use centralized `apiClient` utility from `@/lib/api` for all HTTP requests
- API client handles base URL configuration from environment variables
- Consistent async/await pattern with typed return values
- Services return typed responses based on contracts in `src/contracts/`

### Common Data Patterns

- **Teams**: `{ id, name, ownerName, rank, totalPoints }`
- **Drivers/Constructors**: Extend `BaseRole` interface with `id`, `countryAbbreviation`, `price`, `points`
- **Slots**: Generic slot management with `useSlots<T extends { id: number }>` - rebuilds pool in original order when items removed
- **Auth**: Supabase user + custom profile creation flow via `userProfileService.registerUser()`

## Environment & Configuration

### Required Environment Variables

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_F1_FANTASY_API=your_api_base_url
```

## Development Commands

```bash
npm run dev           # Start dev server with Vite on port 5173
npm test             # Run Vitest test suite (one-time)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage reports
npm run lint         # ESLint with TypeScript rules
npm run build        # Type check + build for production
```

## Error Handling Patterns

### Error Boundary System

The application uses a multi-level error boundary strategy to catch and handle React rendering errors gracefully:

#### ErrorBoundary Component

- **Location**: `src/components/ErrorBoundary/ErrorBoundary.tsx`
- **Purpose**: Class component that catches JavaScript errors in child components
- **Integration**: Integrated with Sentry for error tracking and component stack traces
- **Levels**: Supports `page` and `section` level error boundaries for granular error containment

```typescript
// Page-level boundary (wraps entire routes)
<ErrorBoundary level="page">
  <MyPage />
</ErrorBoundary>

// Section-level boundary (wraps specific components)
<ErrorBoundary level="section">
  <DataFetchingComponent />
</ErrorBoundary>
```

#### React 19 Error Handlers

The application uses React 19's new error handler callbacks in `main.tsx`:

```typescript
const root = createRoot(container, {
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn('Uncaught error', error, errorInfo.componentStack);
  }),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
});
```

- **onUncaughtError**: Handles errors not caught by error boundaries
- **onCaughtError**: Handles errors caught by error boundaries
- **onRecoverableError**: Handles errors React automatically recovers from

### Error Display Components

#### ErrorFallback

- **Location**: `src/components/ErrorBoundary/ErrorFallback.tsx`
- **Purpose**: Default fallback UI displayed by ErrorBoundary
- **Features**: User-friendly error message, expandable error details, optional retry button
- **Variants**: Adapts messaging for page-level or section-level errors

#### ErrorState

- **Location**: `src/components/ErrorState/ErrorState.tsx`
- **Purpose**: Full-page error display for data fetching failures
- **Features**: AlertCircle icon, error message, optional retry button
- **Accessibility**: Uses `role="alert"` for screen reader announcements

```typescript
<ErrorState message={error} onRetry={() => refetch()} />
```

#### InlineError

- **Location**: `src/components/InlineError/InlineError.tsx`
- **Purpose**: Form-level inline error messages for validation and submission failures
- **Accessibility**: Uses `role="alert"` for immediate screen reader feedback
- **Display**: Persistent (not dismissible), shows AlertCircle icon with error message

```typescript
{errorMessage && <InlineError message={errorMessage} />}
```

#### InlineSuccess

- **Location**: `src/components/InlineSuccess/InlineSuccess.tsx`
- **Purpose**: Success messages for actions that do not redirect (e.g., profile updates)
- **Accessibility**: Uses `role="status"` for polite screen reader announcements
- **Display**: Shows CheckCircle icon with success message

```typescript
{successMessage && <InlineSuccess message={successMessage} />}
```

### Error Handling Strategy

#### Toast Usage

Toasts are used sparingly in the application:

- **Background operations**: Avatar uploads and async operations that complete after user interaction
- **Form errors**: Display inline with InlineError component (not toasts)
- **Validation errors**: Display inline with InlineError component (not toasts)
- **Redirect scenarios**: Navigation serves as implicit feedback (no toast)

#### Form Error Pattern

```typescript
const [errorMessage, setErrorMessage] = useState('');
const { message, announce } = useLiveRegion();

try {
  await submitForm(data);
  navigate('/success');
} catch (error) {
  const message = error instanceof Error ? error.message : 'Submission failed';
  setErrorMessage(message);
  announce(message);
}

// In JSX
{errorMessage && <InlineError message={errorMessage} />}
<LiveRegion message={message} />
```

#### Component Error Pattern

```typescript
// Route-level error handling (preferred for route components)
// Errors thrown in loaders are caught by the route's errorComponent:
const leagueRoute = createRoute({
  loader: async ({ params }) => {
    const league = await getLeagueById(params.leagueId);
    if (!league) throw notFound({ routeId: ROUTE_ID });
    return { league };
  },
  errorComponent: ({ error }) => (
    <ErrorFallback error={error} level="page" />
  ),
  notFoundComponent: () => (
    <div>League not found</div>
  ),
});

// Component-level error handling (for non-route errors)
if (error) {
  return <ErrorState message={error} onRetry={() => refetch()} />;
}
```

## Accessibility Features

### WCAG 2.1 Level AA Compliance

The application implements W3C WAI-ARIA standards for comprehensive accessibility:

#### LoadingButton Pattern

**Accessible Loading States** - `src/components/LoadingButton/LoadingButton.tsx`

- Uses `aria-busy="true"` during loading to maintain button in accessibility tree and keyboard focus order
- Button remains focusable during loading (WCAG 2.1.1 Keyboard compliance)
- Displays spinner icon and customizable loading text for visual feedback
- Does not use `disabled` attribute to preserve keyboard navigation and screen reader access

```typescript
<LoadingButton
  isLoading={isSubmitting}
  loadingText="Submitting..."
>
  Submit
</LoadingButton>

// Renders as:
<button aria-busy="true">
  <Spinner /> Submitting...
</button>
```

#### Screen Reader Announcements

**LiveRegion Component** - `src/components/LiveRegion/LiveRegion.tsx`

Provides dynamic announcements to assistive technologies:

```typescript
const { message, announce, clear } = useLiveRegion();

announce('Form submission failed');

<LiveRegion message={message} politeness="polite" />
```

**ARIA Attributes:**

- `role="status"` - Indicates status message region
- `aria-live="polite"` - Announces when user is idle (default)
- `aria-live="assertive"` - Interrupts to announce immediately (use for critical errors)
- `aria-atomic="true"` - Announces entire content when changed
- `className="sr-only"` - Visually hidden but announced by screen readers

**Politeness Levels:**

- **Polite**: Use for general updates (form success, info messages)
- **Assertive**: Use for critical errors requiring immediate attention

#### Alert Roles

**Inline Error Messages**

```typescript
<InlineError message="Email is required" />
```

- Renders with `role="alert"` for immediate screen reader announcement
- WCAG 4.1.3 (Status Messages) compliant
- Used for form validation errors and submission failures

**Error States**

```typescript
<ErrorState message="Failed to load data" onRetry={retry} />
```

- Renders with `role="alert"` for critical page-level errors

#### Status Roles

**Success Messages and Loading States**

```typescript
<InlineSuccess message="Profile updated successfully" />

<div role="status">Loading data...</div>
```

- Renders with `role="status"` for polite announcement when user is idle
- WCAG 4.1.3 (Status Messages) compliant
- Used for non-critical updates, loading states, and success messages

### Accessibility Checklist

All interactive components must:

- Be keyboard navigable (Tab, Enter, Space)
- Provide focus indicators (visible outline)
- Include appropriate ARIA attributes
- Announce state changes to screen readers
- Maintain logical focus order
- Support high contrast mode
- Have sufficient color contrast (4.5:1 minimum)

### Testing Accessibility

**Manual Testing:**

- Test with VoiceOver (macOS): ⌘ + F5
- Test with keyboard only: Unplug mouse, use Tab, Enter, Space
- Test with high contrast mode enabled
- Verify focus indicators are visible

**Automated Testing:**

- Tests verify ARIA attributes (`aria-busy`, `aria-live`, `role`)
- Tests verify keyboard navigation (focus, click events)
- Tests verify screen reader content (visually hidden text)

## Core Principles

When working on this codebase, prioritize:

- **Type safety** - Leverage TypeScript fully
- **Accessibility first** - Follow WCAG 2.1 Level AA standards
- **Component composition** - Build reusable, composable components
- **Separation of concerns** - Keep UI, business logic, and data access separate
- **Modern React patterns** - Use hooks and context for state management
- **User feedback clarity** - Prefer inline errors over toasts for contextual feedback
