---
description: 'Sentry integration for React application. Error tracking, performance monitoring, and structured logging with @sentry/react.'
applyTo: '**/*.{ts,tsx,jsx,js}'
---

# Sentry Integration Guidelines

## Overview

Sentry provides error tracking, performance monitoring, and logging for this React application. Follow these guidelines to ensure proper implementation and consistent patterns across the codebase.

## Initialization

### Setup Requirements

- Sentry **must** be initialized before any other imports in `main.tsx`
- Always include `enableLogs: true` for production configurations
- Use environment variables for DSN configuration
- Configure appropriate sample rates for your environment

### Basic Configuration

```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enableLogs: true,
  tracesSampleRate: 1.0, // Adjust for production
  integrations: [Sentry.consoleLoggingIntegration({ levels: ['log', 'error', 'warn'] })],
});
```

## Error Tracking

### When to Capture Exceptions

- Use `Sentry.captureException(error)` in try-catch blocks for expected errors
- **Never use for control flow** - only for actual error conditions
- Include relevant context data when capturing errors

### Exception Capture Pattern

```typescript
try {
  await someRiskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { section: 'payment-processing' },
    extra: { userId, orderId },
  });
  // Handle error gracefully for user
}
```

### What NOT to Capture

- Expected validation errors (handle with UI feedback instead)
- User cancellations or deliberate actions
- Network errors that trigger retry logic (unless they persist)

## Performance Monitoring

### Custom Spans

Use `Sentry.startSpan()` for tracking important operations:

```typescript
// API Call Instrumentation
async function fetchUserData(userId: number) {
  return await Sentry.startSpan(
    {
      op: 'http.client',
      name: `GET /api/users/${userId}`,
    },
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      return response.json();
    },
  );
}

// UI Action Instrumentation
function handleButtonClick() {
  Sentry.startSpan(
    {
      op: 'ui.click',
      name: 'Submit Team',
    },
    (span) => {
      span.setAttribute('teamSize', slots.length);
      span.setAttribute('budget', remainingBudget);

      submitTeam();
    },
  );
}
```

### Span Naming Convention

- **Format**: `{operation} {target}`
- **Examples**:
  - `"GET /api/teams/123"`
  - `"Submit Registration Form"`
  - `"Load Driver Pool"`
- **Operations**: Follow pattern `category.action`
  - `http.client` - API calls
  - `ui.click` - User interactions
  - `ui.load` - Component/page loads
  - `db.query` - Database operations (if applicable)

## Structured Logging

**Default Logging Approach**: When asked to add logging to code, always use Sentry's structured logging (`Sentry.logger.*`) instead of `console.log`. This ensures logs are properly captured, searchable, and contextualized in Sentry.

### Logger Levels

Use appropriate log levels based on severity:

```typescript
import * as Sentry from '@sentry/react';

// Trace - Detailed debugging (rarely used)
Sentry.logger.trace('Starting database connection', { database: 'users' });

// Debug - Detailed info for debugging
Sentry.logger.debug(Sentry.logger.fmt`Cache miss for user: ${userId}`);

// Info - General informational messages
Sentry.logger.info('Team submitted successfully', { teamId: 123 });

// Warn - Warning conditions that should be reviewed
Sentry.logger.warn('API rate limit approaching', {
  endpoint: '/api/drivers',
  remainingCalls: 50,
});

// Error - Error conditions that need attention
Sentry.logger.error('Failed to load team data', {
  teamId,
  error: error.message,
});

// Fatal - Critical errors causing system failure
Sentry.logger.fatal('Database connection lost', {
  database: 'users',
  attemptCount: 5,
});
```

### Template Literals for Dynamic Data

Use `Sentry.logger.fmt` for including variables:

```typescript
// Good - Uses template literal
Sentry.logger.debug(Sentry.logger.fmt`User ${userId} updated team ${teamId}`);

// Bad - Don't concatenate strings
Sentry.logger.debug('User ' + userId + ' updated team ' + teamId);
```

### Contextual Data

Always include relevant context as second parameter:

```typescript
Sentry.logger.error('Payment processing failed', {
  orderId: 'order_123',
  amount: 99.99,
  currency: 'USD',
  userId: currentUser.id,
});
```

## Integration Configuration

### Console Logging Integration

Enable automatic console log capture for development:

```typescript
integrations: [
  Sentry.consoleLoggingIntegration({
    levels: ['log', 'error', 'warn'],
  }),
];
```

### React Integration

Automatically capture React component errors:

```typescript
integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()];
```

## Best Practices

### Do's ✅

- Initialize Sentry early in the application lifecycle
- Use structured logging with contextual data
- Set meaningful span names and operations
- Include user context when available (non-PII)
- Configure appropriate sample rates for production
- Use environment-specific configurations

### Don'ts ❌

- Don't log sensitive information (passwords, tokens, credit cards)
- Don't use Sentry for application control flow
- Don't capture exceptions for expected user behavior
- Don't create spans for trivial operations
- Don't hardcode DSN or configuration values
- Don't enable 100% sampling in high-traffic production

## React-Specific Patterns

### Error Boundaries

Sentry automatically integrates with React error boundaries:

```typescript
import * as Sentry from "@sentry/react";

const App = () => {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <YourApp />
    </Sentry.ErrorBoundary>
  );
};
```

### React 19 Error Handlers

Customize error handling for React 19's `createRoot` and `hydrateRoot`:

```typescript
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";

const container = document.getElementById("app");
const root = createRoot(container, {
  // Callback for errors not caught by ErrorBoundary
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn("Uncaught error", error, errorInfo.componentStack);
  }),
  // Callback for errors caught by ErrorBoundary
  onCaughtError: Sentry.reactErrorHandler(),
  // Callback for errors React automatically recovers from
  onRecoverableError: Sentry.reactErrorHandler(),
});
root.render(<App />);
```

### Error Capture in useEffect

Use `useEffect` to capture errors and avoid render cycles:

```typescript
import * as Sentry from '@sentry/react';
import { useEffect } from 'react';

function MyComponent() {
  const [info, error] = useQuery('/api/info');

  useEffect(() => {
    if (error) {
      Sentry.captureException(error);
    }
  }, [error]);

  // Component logic...
}
```

### React Router Integration

Track navigation performance:

```typescript
import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { useLocation } from 'react-router';

function usePageViews() {
  const location = useLocation();

  useEffect(() => {
    Sentry.startSpan(
      {
        op: 'navigation',
        name: `Route: ${location.pathname}`,
      },
      () => {
        // Page view tracking
      },
    );
  }, [location]);
}
```

## Environment Configuration

### Development

```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: 'development',
  enableLogs: true,
  tracesSampleRate: 1.0, // Capture all traces
  debug: true, // Enable debug mode
});
```

### Production

```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: 'production',
  enableLogs: true,
  tracesSampleRate: 0.1, // Sample 10% of traces
  beforeSend(event) {
    // Scrub sensitive data before sending
    return event;
  },
});
```

## Quick Reference

### When to Use What

| Scenario          | Tool                        | Example                               |
| ----------------- | --------------------------- | ------------------------------------- |
| Unexpected errors | `Sentry.captureException()` | API failures, unexpected exceptions   |
| Track performance | `Sentry.startSpan()`        | API calls, expensive operations       |
| Debug information | `Sentry.logger.debug()`     | Cache misses, state changes           |
| Important events  | `Sentry.logger.info()`      | User actions, successful operations   |
| Problems/warnings | `Sentry.logger.warn()`      | Rate limits, deprecations             |
| Critical errors   | `Sentry.logger.error()`     | Failed operations that need attention |

## Testing with Sentry

### Disable in Tests

```typescript
// In setupTests.ts or test files
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  startSpan: vi.fn((_, fn) => fn()),
  logger: {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    fmt: (strings: TemplateStringsArray, ...values: any[]) =>
      strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
  },
}));
```
