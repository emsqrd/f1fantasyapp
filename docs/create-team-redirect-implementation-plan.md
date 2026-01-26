# Fix Create Team Redirect Flow

## Problem
When users visit a league invite link (`/join/{token}`) without a team, they're prompted to create a team first. The redirect parameter is set (`/create-team?redirect=/join/{token}`), but the CreateTeam component ignores it and always navigates to `/team/{teamId}`. Users lose context and must manually navigate back to the invite.

## Solution
Implement TanStack Router search parameter validation and redirect handling to send users back to the invite page after team creation. **This follows TanStack Router's official documented pattern** for post-authentication redirects.

**User Flow:**
1. User visits `/join/{token}` (no team)
2. Clicks "Create Team First" → `/create-team?redirect=/join/{token}`
3. Creates team → redirects to `/join/{token}`
4. Clicks "Join League" → joins and navigates to league page

## Why This Is Scalable & Maintainable

✅ **Official TanStack Router Pattern** - Documented in [Search Params Guide](https://tanstack.com/router/v1/docs/framework/react/guide/search-params) and [Authentication How-To](https://tanstack.com/router/v1/docs/framework/react/how-to/setup-authentication)
✅ **Type-Safe** - TypeScript infers search param types from Zod schema
✅ **Graceful Degradation** - Uses `.catch()` to provide fallbacks instead of throwing errors
✅ **Reusable** - Shared schema can be used across multiple routes (sign-in, sign-up, create-team)
✅ **Shareable URLs** - Redirect params survive page refresh and can be bookmarked
✅ **Testable** - Search params can be easily mocked in tests

## Implementation Steps

### 1. Add Shared Search Parameter Schema (router.tsx)
Create a **reusable** Zod schema for validating redirect URLs (prevents open redirect vulnerabilities).

**File:** `web/src/router.tsx`
**Location:** After line 68 (near other Zod schemas like `leagueIdParamsSchema`)

```typescript
/**
 * Zod schema for validating redirect search parameters.
 *
 * Uses `.catch()` for graceful error handling per TanStack Router best practices:
 * Invalid redirect values fall back to undefined instead of throwing errors.
 *
 * Security: Only allows internal paths starting with '/' to prevent open redirects.
 *
 * @see {@link https://tanstack.com/router/latest/docs/framework/react/how-to/validate-search-params | Validate Search Parameters}
 */
const redirectSearchSchema = z.object({
  redirect: z
    .string()
    .refine(
      (url) => url.startsWith('/'),
      'Redirect must be an internal path'
    )
    .catch(undefined)
    .optional(),
});
```

**Key differences from original approach:**
- Uses `.catch(undefined)` for graceful degradation (TanStack Router best practice)
- Malformed redirect values fall back to `undefined` instead of breaking the page
- User experience stays smooth even with invalid query params

### 2. Update createTeamRoute (router.tsx)
Add search parameter validation to the route definition.

**File:** `web/src/router.tsx`
**Location:** Line 318 (createTeamRoute definition)

```typescript
const createTeamRoute = createRoute({
  getParentRoute: () => noTeamLayoutRoute,
  path: 'create-team',
  validateSearch: redirectSearchSchema,  // Add this line
  staticData: { pageTitle: 'Create Team' },
  component: CreateTeam,
  // ... rest unchanged
});
```

### 3. Update CreateTeam Component
Read redirect parameter and use it for navigation after team creation.

**File:** `web/src/components/CreateTeam/CreateTeam.tsx`

**Changes:**
1. Import `useSearch` (line 6):
```typescript
import { useNavigate, useSearch } from '@tanstack/react-router';
```

2. Add after line 21 (after `const navigate = useNavigate()`):
```typescript
const search = useSearch({ from: '/create-team' });
```

3. Replace line 47 (navigation logic):
```typescript
// Before:
navigate({ to: '/team/$teamId', params: { teamId: String(createdTeam.id) } })

// After:
const redirectPath = search.redirect || `/team/${createdTeam.id}`;
navigate({ to: redirectPath });
```

**Type Safety:**
- `search` is fully typed by TypeScript (inferred from `redirectSearchSchema`)
- `search.redirect` is `string | undefined`
- Fallback preserves existing behavior when no redirect param

**Behavior:**
- If redirect param exists and valid → navigate to redirect URL (e.g., `/join/{token}`)
- If redirect param invalid or missing → fallback to team page (preserves existing behavior)

## Scalability & Reusability

### Future Routes Using Redirect Pattern
The `redirectSearchSchema` can be reused across multiple routes:

1. **Sign-in route** - Redirect after authentication
2. **Sign-up route** - Redirect after registration
3. **Any future auth gates** - Consistent pattern across the app

### Example: Extending to Sign-In Route
```typescript
const signInRoute = createRoute({
  // ... existing config
  validateSearch: redirectSearchSchema,  // Reuse the schema
  component: SignInForm,
});

// In SignInForm.tsx
const search = useSearch({ from: '/sign-in' });
const redirectPath = search.redirect || '/leagues';
await navigate({ to: redirectPath });
```

This creates a **complete redirect chain**:
1. Unauthenticated user visits `/join/abc123`
2. Clicks "Sign In" → `/sign-in?redirect=/join/abc123`
3. Signs in → redirects to `/join/abc123`
4. Sees "Create Team First" → `/create-team?redirect=/join/abc123`
5. Creates team → redirects to `/join/abc123`
6. Joins league → complete!

### Alternative: Shared Hook (Future Enhancement)
For even better maintainability, create a custom hook:

```typescript
// hooks/useRedirect.ts
export function useRedirect(fallback: string) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });

  return (redirect?: string) => {
    navigate({ to: redirect || search.redirect || fallback });
  };
}
```

This is **optional** and can be added later if the pattern is used in 3+ places.

## Critical Files

- `web/src/router.tsx` (lines 68, 318-339)
- `web/src/components/CreateTeam/CreateTeam.tsx` (lines 6, 21, 47)

## Verification Steps

### Manual Testing
1. Start the dev server: `npm run web:dev`
2. Navigate to a valid invite link as an authenticated user without a team:
   - Example: `http://localhost:5173/join/9KusyKe59N`
3. Click "Create Team First" button
4. Verify URL is: `http://localhost:5173/create-team?redirect=%2Fjoin%2F9KusyKe59N`
5. Enter a team name and submit
6. **Expected:** Redirected to `/join/9KusyKe59N` with "Join League" button visible
7. Click "Join League"
8. **Expected:** Successfully joins league and navigates to league page

### Fallback Behavior
1. Navigate directly to `/create-team` (no redirect param)
2. Create a team
3. **Expected:** Navigated to `/team/{teamId}` (existing behavior)

### Security Testing
Try malicious redirect URLs to verify they're blocked:
- `?redirect=https://evil.com` → Should fail validation
- `?redirect=//evil.com` → Should fail validation
- `?redirect=javascript:alert(1)` → Should fail validation

### Integration Test
Test the complete flow for a new user:
1. User receives invite link (unauthenticated)
2. Clicks invite link → prompted to sign in/sign up
3. Signs up → redirected to create-team with redirect param
4. Creates team → back to invite page
5. Joins league → success!

## Comparison with Alternative Approaches

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Search params with Zod** (chosen) | Type-safe, shareable URLs, survives refresh, TanStack Router official pattern | Visible in URL bar | ✅ Best practice |
| Session Storage | Hidden from URL | Lost on page refresh, not shareable, harder to test | ❌ Not recommended |
| Router State | Type-safe | Lost on page refresh, not shareable | ❌ Not recommended |
| Custom redirect context | Could work | Over-engineered for this use case | ❌ Unnecessary |

## TanStack Router Best Practices (Sources)

This implementation follows official TanStack Router documentation:

1. **Search parameter validation** - [Validate Search Parameters with Schemas](https://tanstack.com/router/latest/docs/framework/react/how-to/validate-search-params)
   - Use `.catch()` for graceful error handling
   - Provide sensible fallbacks for malformed params

2. **Redirect pattern** - [Search Params Guide](https://tanstack.com/router/v1/docs/framework/react/guide/search-params)
   - Store redirect URL in search params for post-auth flows
   - Example from docs: `validateSearch: (search) => ({ redirect: (search.redirect as string) || '/' })`

3. **Type safety** - [Data Loading](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading)
   - TypeScript infers types from Zod schemas automatically
   - No manual type annotations needed in components

4. **Router context pattern** - [Authenticated Routes](https://tanstack.com/router/v1/docs/framework/react/guide/authenticated-routes)
   - Guards use `beforeLoad` with `throw redirect()`
   - Components use search params with `useSearch()`

## Bonus Enhancement (Optional)
Apply the same pattern to SignInForm and SignUpForm to complete the full auth flow redirect chain. This would allow unauthenticated users visiting invite links to sign in/up and flow through team creation back to the invite page.

**Files:**
- `web/src/router.tsx` - Add `validateSearch: redirectSearchSchema` to signInRoute and signUpRoute
- `web/src/components/auth/SignInForm/SignInForm.tsx` (line 31)
- `web/src/components/auth/SignUpForm/SignUpForm.tsx` (line 66)

**Implementation:** Use the same pattern as CreateTeam component (read `search.redirect`, fallback to default path)
