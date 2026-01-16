# Implementation Plan for Issue #43: Complete User Feedback System

## Overview

Implementing comprehensive error handling, loading states, and accessibility improvements for the F1 Fantasy Sports application following React 19.2, React Testing Library, Sentry, and Vitest best practices.

## Toast Strategy: Option A++ (Final)

**Remove ALL toasts except background operations** (avatar uploads only):

- ✅ Redirect scenarios: Redirect IS the feedback (no toast needed)
- ✅ Form errors: Inline errors with role="alert" (contextual, persistent)
- ✅ Non-redirect success: Inline success messages (e.g., Account form profile update)
- ✅ Background operations: Keep toast for avatar upload (async, can't wait for completion)
- **Result**: Cleaner UX, no redundant feedback, follows modern SaaS patterns (GitHub, Linear, Stripe)

## Accessibility Approach: W3C WAI-ARIA Standards

**LoadingButton Pattern** (no disabled attribute):

- Use `aria-busy="true"` during loading (not `disabled` attribute)
- Button remains focusable and in accessibility tree (WCAG 2.1.1 compliant)
- Visual loading indicator (spinner) + "Loading..." text
- Works identically on mobile and desktop
- **Why**: W3C APG states "when action unavailable, use aria-disabled='true'" - keeps button accessible to keyboard/screen readers

---

## Phase 1: Foundation Components

### 1.1 Error Boundary System

**ErrorBoundary.tsx** (class component)

```typescript
// Location: src/components/ErrorBoundary/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  level?: 'page' | 'section';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <ErrorFallback error={this.state.error} onReset={this.reset} level={this.props.level} />;
    }

    return this.props.children;
  }
}
```

**ErrorFallback.tsx** (reusable fallback UI)

```typescript
// Location: src/components/ErrorBoundary/ErrorFallback.tsx
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  error: Error | null;
  onReset: () => void;
  level?: 'page' | 'section';
}

export function ErrorFallback({ error, onReset, level = 'page' }: Props) {
  const isPageLevel = level === 'page';

  return (
    <div className={isPageLevel ? 'flex min-h-screen items-center justify-center' : ''} role="alert">
      <Card className="max-w-md p-6">
        <h2 className="text-lg font-semibold text-destructive">
          {isPageLevel ? 'Something went wrong' : 'Unable to load this section'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <Button onClick={onReset} className="mt-4" variant="outline">
          Try Again
        </Button>
      </Card>
    </div>
  );
}
```

**ErrorState.tsx** (full-page errors)

```typescript
// Location: src/components/ErrorState/ErrorState.tsx
import { Button } from '@/components/ui/button';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="flex min-h-[400px] items-center justify-center" role="alert">
      <div className="text-center">
        <p className="text-sm text-destructive">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
```

**InlineError.tsx** (form-level errors)

```typescript
// Location: src/components/InlineError/InlineError.tsx
interface Props {
  message: string;
}

export function InlineError({ message }: Props) {
  return (
    <div className="rounded-md bg-destructive/10 p-3" role="alert">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
```

**InlineSuccess.tsx** (non-redirect success messages)

```typescript
// Location: src/components/InlineSuccess/InlineSuccess.tsx
interface Props {
  message: string;
}

export function InlineSuccess({ message }: Props) {
  return (
    <div className="rounded-md bg-green-50 p-3" role="status">
      <p className="text-sm text-green-800">{message}</p>
    </div>
  );
}
```

### 1.2 Loading Components

**LoadingButton.tsx** (accessible loading button)

```typescript
// Location: src/components/LoadingButton/LoadingButton.tsx
import { Button, ButtonProps } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
}

export function LoadingButton({
  isLoading = false,
  loadingText = 'Loading...',
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button aria-busy={isLoading} {...props}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {isLoading ? loadingText : children}
    </Button>
  );
}
```

### 1.3 Screen Reader Announcements

**LiveRegion.tsx** (aria-live announcements)

```typescript
// Location: src/components/LiveRegion/LiveRegion.tsx
import { useEffect, useRef } from 'react';

interface Props {
  message: string;
  politeness?: 'polite' | 'assertive';
}

export function LiveRegion({ message, politeness = 'polite' }: Props) {
  const previousMessage = useRef('');

  useEffect(() => {
    previousMessage.current = message;
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
```

**useLiveRegion.ts** (hook for managing announcements)

```typescript
// Location: src/hooks/useLiveRegion.ts
import { useCallback, useState } from 'react';

export function useLiveRegion() {
  const [message, setMessage] = useState('');

  const announce = useCallback((text: string) => {
    setMessage('');
    setTimeout(() => setMessage(text), 100);
    setTimeout(() => setMessage(''), 5000);
  }, []);

  const clear = useCallback(() => {
    setMessage('');
  }, []);

  return { message, announce, clear };
}
```

---

## Phase 2: Error Boundary Integration

### 2.1 Update main.tsx with React 19 Error Handlers

```typescript
// Location: src/main.tsx (lines 54-65)
// Replace existing createRoot() with:
const container = document.getElementById('root');
if (!container) throw new Error('Root container not found');

const root = createRoot(container, {
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.error('Uncaught error:', error, errorInfo.componentStack);
  }),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
});

root.render(
  <StrictMode>
    <ErrorBoundary level="page">
      <AuthProvider>
        <TeamProvider>
          <BrowserRouter>
            <Routes>
              {/* existing routes */}
            </Routes>
          </BrowserRouter>
        </TeamProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
```

### 2.2 Add Nested Error Boundaries

**Wrap data-fetching routes:**

```typescript
// Location: src/main.tsx (add to routes)
<Route path="/leagues/:id" element={
  <ErrorBoundary level="section">
    <League />
  </ErrorBoundary>
} />
<Route path="/teams/:id" element={
  <ErrorBoundary level="section">
    <Team />
  </ErrorBoundary>
} />
```

---

## Phase 3: Form Refactoring (5 Forms)

### 3.1 SignInForm.tsx

**Changes:**

- Line 76: Replace `<Button disabled={isLoading}>` with `<LoadingButton isLoading={isLoading}>`
- Add `const { message, announce } = useLiveRegion()`
- Add `<LiveRegion message={message} />`
- Line 49: Replace `toast.error()` with `setErrorMessage()` + `announce()`
- **No toast.success()** - redirect to /dashboard IS the feedback

### 3.2 SignUpForm.tsx

**Changes:**

- Line 121: Replace `<Button disabled={isLoading}>` with `<LoadingButton isLoading={isLoading}>`
- Add `const { message, announce } = useLiveRegion()`
- Add `<LiveRegion message={message} />`
- Line 64, 85, 94: Replace `toast.error()` with `setErrorMessage()` + `announce()`
- **No toast.success()** - redirect to /dashboard IS the feedback

### 3.3 CreateLeague.tsx

**Changes:**

- Line 117: Replace `<Button disabled={isSubmitting || !isDirty}>` with `<LoadingButton isLoading={isSubmitting}>`
- Add `const { message, announce } = useLiveRegion()`
- Add `<LiveRegion message={message} />`
- Line 45: Replace `toast.error()` with `setErrorMessage()` + `announce()`
- Line 38: **Remove `toast.success()`** - dialog close + navigation IS the feedback
- Add `<InlineError message={errorMessage} />` below form if errorMessage exists

### 3.4 Account.tsx

**Changes:**

- Line 171: Replace `<Button disabled={isSubmitting || !isDirty}>` with `<LoadingButton isLoading={isSubmitting}>`
- Add `const { message, announce } = useLiveRegion()`
- Add `<LiveRegion message={message} />`
- Line 104, 115, 126: Replace `toast.error()` with `setErrorMessage()` + `announce()`
- Line 121: **Add `<InlineSuccess message="Profile updated successfully" />`** (non-redirect, needs visual confirmation)
- Line 103: **KEEP toast.error() for avatar upload** (background operation exception)

### 3.5 CreateTeam.tsx

**Changes:**

- Line 75: Replace `<Button disabled={isSubmitting || !isDirty || isPending}>` with `<LoadingButton isLoading={isSubmitting || isPending}>`
- Add `const { message, announce } = useLiveRegion()`
- Add `<LiveRegion message={message} />`
- Line 48: Replace `toast.error()` with `setErrorMessage()` + `announce()`
- Line 39: **Remove `toast.success()`** - redirect to /teams/{id} IS the feedback

---

## Phase 4: Component Error Refactoring

### 4.1 League.tsx (Line 36)

**Changes:**

- Replace inline `<div role="error">{error}</div>` with `<ErrorState message={error} onRetry={() => window.location.reload()} />`
- Already has loading state with `role="status"` (keep)

### 4.2 Team.tsx (Line 37)

**Changes:**

- Add `<ErrorState message={error} onRetry={() => window.location.reload()} />` for error state
- Add `role="alert"` if using inline error div
- Already has loading state with `role="status"` (keep)

### 4.3 RolePicker.tsx

**Changes:**

- Existing error handling in useEffect is adequate (logs to console, maintains error state)
- Add ErrorBoundary wrapper in parent components (League.tsx, Team.tsx) to catch rendering errors
- Keep optimistic update rollback pattern (lines 76-96)

---

## Phase 5: Testing

### 5.1 Component Tests

**ErrorBoundary.test.tsx**

```typescript
describe('ErrorBoundary', () => {
  it('catches render errors and displays fallback');
  it('calls Sentry.captureException with error details');
  it('resets error state when reset button clicked');
  it('uses custom fallback when provided');
  it('distinguishes between page and section level errors');
});
```

**LoadingButton.test.tsx**

```typescript
describe('LoadingButton', () => {
  it('sets aria-busy to true when loading');
  it('displays loading text and spinner when loading');
  it('does not disable button during loading');
  it('remains keyboard accessible during loading');
  it('passes through button props correctly');
});
```

**LiveRegion.test.tsx**

```typescript
describe('LiveRegion', () => {
  it('announces messages with aria-live');
  it('clears message after timeout');
  it('supports polite and assertive politeness');
});
```

**useLiveRegion.test.ts**

```typescript
describe('useLiveRegion', () => {
  it('announces messages correctly');
  it('clears message after 5 seconds');
  it('allows manual clearing');
});
```

### 5.2 Form Test Updates

Update tests for:

- SignInForm.test.tsx - verify LoadingButton, LiveRegion, no disabled button
- SignUpForm.test.tsx - verify LoadingButton, LiveRegion, no disabled button
- CreateLeague.test.tsx - verify LoadingButton, LiveRegion, inline error
- Account.test.tsx - verify LoadingButton, LiveRegion, inline success
- CreateTeam.test.tsx - verify LoadingButton, LiveRegion, no disabled button

### 5.3 Integration Tests

- Verify error boundaries catch errors in League, Team components
- Verify form submissions work with LoadingButton
- Verify screen reader announcements with LiveRegion
- Verify redirect feedback works without toasts

---

## Phase 6: Documentation & Validation

### 6.1 Update Documentation

- Document error handling patterns in architecture.md
- Document accessibility features (aria-busy, aria-live, role="alert")
- Document toast removal rationale
- Document W3C WAI-ARIA compliance approach

### 6.2 Manual Testing Checklist

- [ ] Test with VoiceOver (macOS): Verify LoadingButton announces state
- [ ] Test with VoiceOver: Verify LiveRegion announces errors
- [ ] Test with keyboard only: Verify buttons focusable during loading
- [ ] Test form submissions: Verify inline errors appear
- [ ] Test redirects: Verify no toasts shown
- [ ] Test Account form: Verify inline success message
- [ ] Test avatar upload: Verify toast shown (background operation)

### 6.3 WCAG 2.1 Validation

- [ ] **4.1.3 Status Messages** - LiveRegion with aria-live
- [ ] **1.3.1 Info and Relationships** - role="alert" for errors
- [ ] **2.1.1 Keyboard** - LoadingButton remains focusable (no disabled)
- [ ] **3.2.2 On Input** - No unexpected context changes

---

## Implementation Order

1. **Phase 1** (Foundation) - Create all components first
2. **Phase 2** (Integration) - Add error boundaries to main.tsx
3. **Phase 3 & 4** (Parallel) - Refactor forms and components simultaneously
4. **Phase 5** (Concurrent) - Write tests as components are created
5. **Phase 6** (Final) - Validation and documentation

---

## Key Technical Details

**W3C Guidance Applied:**

- aria-disabled="true" keeps buttons accessible (not HTML disabled)
- aria-busy="true" for loading states
- role="alert" for critical errors
- aria-live="polite" for status updates

**Sentry Integration:**

- React 19 error handlers (onUncaughtError, onCaughtError, onRecoverableError)
- captureException() in ErrorBoundary componentDidCatch
- Component stack traces captured

**Testing Strategy:**

- Focus on behavior, not implementation
- Test accessibility with screen reader simulation
- Verify keyboard navigation works
- Test error recovery flows

---

## Files to Create

### New Components (8 files)

1. `src/components/ErrorBoundary/ErrorBoundary.tsx`
2. `src/components/ErrorBoundary/ErrorFallback.tsx`
3. `src/components/ErrorState/ErrorState.tsx`
4. `src/components/InlineError/InlineError.tsx`
5. `src/components/InlineSuccess/InlineSuccess.tsx`
6. `src/components/LoadingButton/LoadingButton.tsx`
7. `src/components/LiveRegion/LiveRegion.tsx`
8. `src/hooks/useLiveRegion.ts`

### Test Files (8 files)

1. `src/components/ErrorBoundary/ErrorBoundary.test.tsx`
2. `src/components/ErrorBoundary/ErrorFallback.test.tsx`
3. `src/components/ErrorState/ErrorState.test.tsx`
4. `src/components/InlineError/InlineError.test.tsx`
5. `src/components/InlineSuccess/InlineSuccess.test.tsx`
6. `src/components/LoadingButton/LoadingButton.test.tsx`
7. `src/components/LiveRegion/LiveRegion.test.tsx`
8. `src/hooks/useLiveRegion.test.ts`

### Files to Modify (7 files)

1. `src/main.tsx` - Add error handlers and root ErrorBoundary
2. `src/components/auth/SignInForm/SignInForm.tsx` - LoadingButton, LiveRegion
3. `src/components/auth/SignUpForm/SignUpForm.tsx` - LoadingButton, LiveRegion
4. `src/components/CreateLeague/CreateLeague.tsx` - LoadingButton, LiveRegion, InlineError
5. `src/components/Account/Account.tsx` - LoadingButton, LiveRegion, InlineSuccess
6. `src/components/CreateTeam/CreateTeam.tsx` - LoadingButton, LiveRegion
7. `src/components/League/League.tsx` - ErrorState component
8. `src/components/Team/Team.tsx` - ErrorState component

---

## Success Criteria

✅ All 5 forms use LoadingButton (no disabled buttons)
✅ All forms provide screen reader announcements via LiveRegion
✅ All inline errors use role="alert"
✅ Error boundaries catch and report React errors to Sentry
✅ No toasts for redirects or form errors (only avatar upload)
✅ All buttons remain keyboard accessible during loading
✅ WCAG 2.1 Level AA compliance achieved
✅ 100% test coverage for new components
✅ Manual accessibility testing passed with VoiceOver
