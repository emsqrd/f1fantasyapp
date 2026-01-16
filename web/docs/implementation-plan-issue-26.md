---
goal: Migrate from React Router v7 to TanStack Router for improved type safety and routing architecture
version: 1.0
date_created: 2024-12-30
last_updated: 2026-01-03
owner: F1 Companion Team
status: 'Complete'
tags: ['migration', 'architecture', 'routing', 'type-safety', 'performance']
---

# Migrate to TanStack Router - Implementation Plan

![Status: Complete](https://img.shields.io/badge/status-Complete-green)

This implementation plan provides a comprehensive, phased approach for migrating the F1 Fantasy Sports application from React Router v7 to TanStack Router using **code-based routing**. The migration is structured into 9 phases with 97 specific tasks, eliminating manual data fetching patterns, improving type safety, simplifying route guards, and enabling better performance through automatic preloading. File-based routing can be adopted later if desired, but is not required for this migration.

## 1. Requirements & Constraints

### Core Requirements

- **REQ-001**: All route parameters must be fully type-safe with compile-time validation
- **REQ-002**: Data must load before component renders (eliminate content flash)
- **REQ-003**: Route guards must be declarative and consolidated in route definitions
- **REQ-004**: All existing routes must maintain functional parity
- **REQ-005**: Authentication flows must work identically to current implementation
- **REQ-006**: Team context logic must be preserved
- **REQ-007**: All tests must pass with updated routing patterns
- **REQ-008**: Sentry integration must be maintained for error tracking
- **REQ-009**: Accessibility features must be preserved or improved
- **REQ-010**: All routes must have errorComponent configured for consistent error UX
- **REQ-011**: Global notFoundComponent must handle invalid routes
- **REQ-012**: Loader cache configuration must prevent unnecessary refetches

### Framework Requirements

- **FRW-001**: React 19.2 compatibility required
- **FRW-002**: TanStack Router latest stable version (v1.x)
- **FRW-003**: TypeScript strict mode enabled throughout
- **FRW-004**: Vitest and React Testing Library for all tests
- **FRW-005**: Tailwind CSS v4 for styling (no changes required)

### Testing Requirements

- **TEST-001**: Unit tests for all loader functions
- **TEST-002**: Integration tests for route guards (`beforeLoad`)
- **TEST-003**: Navigation flow tests for all protected routes
- **TEST-004**: Type safety validation tests
- **TEST-005**: Error boundary integration tests

### Performance Requirements

- **PERF-001**: Data preloading on link hover must be functional
- **PERF-002**: Route transitions should feel instant with cached data
- **PERF-003**: No performance regressions vs. current implementation
- **PERF-004**: Stale-while-revalidate caching for optimal UX

### Migration Constraints

- **CON-001**: Cannot break production until migration is complete
- **CON-002**: All environment variables must remain unchanged
- **CON-003**: API contracts must remain unchanged
- **CON-004**: No changes to component props interfaces (except route components)

### Security Requirements

- **SEC-001**: JWT tokens must be validated on protected routes
- **SEC-002**: No authentication state must be exposed in URLs
- **SEC-003**: Route guards must prevent unauthorized access
- **SEC-004**: Team ownership validation must remain intact

### Accessibility Guidelines

- **A11Y-001**: All loading states must use `role="status"`
- **A11Y-002**: Error states must use `role="alert"`
- **A11Y-003**: Navigation must be keyboard accessible
- **A11Y-004**: Screen reader announcements for route changes
- **A11Y-005**: Focus management during navigation

### Patterns to Follow

- **PAT-001**: Code-based routing with centralized route configuration
- **PAT-002**: Loader functions for all data fetching
- **PAT-003**: `beforeLoad` for authentication and authorization checks
- **PAT-004**: Type-safe navigation with `useNavigate` hook
- **PAT-005**: Route-level error boundaries
- **PAT-006**: Pending component patterns for loading states

## 2. Implementation Steps

### Phase 1: Setup and Configuration

**GOAL-001**: Install TanStack Router, configure code-based routing, and establish the foundational route tree structure without breaking existing functionality.

| Task      | Description                                                                                            | Completed |
| --------- | ------------------------------------------------------------------------------------------------------ | --------- |
| TASK-001  | Install TanStack Router dependencies: `@tanstack/react-router` and `@tanstack/router-devtools`         | ✅        |
| TASK-002  | Create root route in `src/router.tsx` using `createRootRoute()` with Layout wrapper and error boundary | ✅        |
| TASK-003  | Create initial route tree configuration in `src/router.tsx` with all existing routes defined           | ✅        |
| TASK-004  | Create router instance using `createRouter()` with proper TypeScript configuration                     | ✅        |
| TASK-004a | Configure global `notFoundComponent` in router for 404 handling                                        | ✅        |
| TASK-004b | Configure global `defaultPendingComponent` in router for consistent loading UX                         | ✅        |
| TASK-004c | Configure global `errorComponent` fallback in router for unhandled errors                              | ✅        |
| TASK-005  | Create type-safe route context interface in `src/router.tsx` for auth and team state                   | ✅        |
| TASK-006  | Configure Sentry integration with TanStack Router for performance monitoring                           | ✅        |
| TASK-007  | Update `src/main.tsx` to use `RouterProvider` exclusively (remove `BrowserRouter` entirely)            | ✅        |
| TASK-008  | Test that dev server starts successfully with new router initialized                                   | ✅        |
| TASK-009  | Verify TypeScript compilation passes with router types                                                 | ✅        |
| TASK-010  | Add TanStack Router DevTools to development environment for debugging                                  | ✅        |

**Testing for Phase 1:**

- Verify Vite builds successfully with router plugin
- Confirm `routeTree.gen.ts` generates automatically on file changes
- Validate TypeScript compilation passes with route types
- Test hot module reload works with route files

---

### Phase 2: Auth Context and Route Guards

**GOAL-002**: Migrate authentication and team context to TanStack Router's context system, and create reusable `beforeLoad` guard functions.

| Task     | Description                                                                                    | Completed |
| -------- | ---------------------------------------------------------------------------------------------- | --------- |
| TASK-011 | Create `src/lib/router-context.ts` defining AuthRouteContext and TeamRouteContext interfaces   | ✅        |
| TASK-012 | Update root route to provide auth and team state via context in `beforeLoad`                   | ✅        |
| TASK-013 | Create `src/lib/route-guards.ts` with `requireAuth` guard using `throw redirect()` pattern     | ✅        |
| TASK-014 | Create `requireTeam` guard function in `route-guards.ts` that checks team existence            | ✅        |
| TASK-015 | Create `requireNoTeam` guard function that redirects users with teams using `throw redirect()` | ✅        |
| TASK-016 | Add proper TypeScript type inference for guard return types                                    | ✅        |
| TASK-017 | Write unit tests for `requireAuth` with mock auth context and verify redirect throws           | ✅        |
| TASK-018 | Write unit tests for `requireTeam` with various team states                                    | ✅        |
| TASK-019 | Write unit tests for `requireNoTeam` guard logic                                               | ✅        |
| TASK-020 | Document guard usage patterns including `throw redirect()` pattern in code comments            | ✅        |

**Testing for Phase 2:**

- ✅ Unit test each guard function in isolation
- ✅ Test redirect throws (not returns) with mock router context
- ✅ Validate TypeScript inference for auth state
- ✅ Test guard composition (multiple guards in sequence)

---

### Phase 3: Public Routes Migration

**GOAL-003**: Migrate all public routes (landing page, sign-in, sign-up) to TanStack Router route definitions.

| Task      | Description                                                                                       | Completed |
| --------- | ------------------------------------------------------------------------------------------------- | --------- |
| TASK-021  | Define index route (`/`) in route tree using `createRoute()` for landing page with errorComponent | ✅        |
| TASK-022  | Define sign-in route (`/sign-in`) in route tree with errorComponent                               | ✅        |
| TASK-023  | Define sign-up route (`/sign-up`) in route tree with errorComponent                               | ✅        |
| TASK-024  | Update SignInForm component to use TanStack Router's `useNavigate` hook                           | ✅        |
| TASK-025  | Update SignUpForm component to use type-safe navigation after registration                        | ✅        |
| TASK-026  | Test landing page renders correctly at `/` route                                                  | ✅        |
| TASK-027  | Test sign-in flow navigates to `/leagues` after successful authentication                         | ✅        |
| TASK-028  | Test sign-up flow creates profile and navigates correctly                                         | ✅        |
| TASK-029  | Verify navigation links work with `Link` component from TanStack Router                           | ✅        |
| TASK-030  | Update tests for LandingPage, SignInForm, and SignUpForm components                               | ✅        |
| TASK-030a | Test errorComponent renders correctly for each public route when errors occur                     | ✅        |

**Testing for Phase 3:**

- Integration test: complete sign-in flow end-to-end
- Integration test: complete sign-up flow with profile creation
- Unit test: navigation hooks return type-safe navigate function
- Accessibility test: keyboard navigation on public routes
- Test errorComponent displays for route-level errors

---

### Phase 4: Protected Routes without Data Loading

**GOAL-004**: Migrate simple protected routes (account page) that require authentication but minimal data loading.

| Task      | Description                                                                              | Completed |
| --------- | ---------------------------------------------------------------------------------------- | --------- |
| TASK-031  | Define authenticated layout route in route tree with `requireAuth` guard in `beforeLoad` | ✅        |
| TASK-032  | Define account route (`/account`) as child of authenticated layout                       | ✅        |
| TASK-033  | Add loader function to account route to fetch user profile data before rendering         | ✅        |
| TASK-034  | Update Account component to use `useLoaderData()` hook instead of `useEffect`            | ✅        |
| TASK-035  | Add pending component to show loading state during profile fetch                         | ✅        |
| TASK-036  | Add errorComponent to route definition to catch profile fetch errors                     | ✅        |
| TASK-037  | Update Account form submission to use type-safe navigation                               | ✅        |
| TASK-038  | Test account page access requires authentication                                         | ✅        |
| TASK-039  | Test profile data loads before component renders                                         | ✅        |
| TASK-040  | Update Account component tests to mock `useLoaderData` hook                              | ✅        |
| TASK-040a | Test errorComponent renders when profile fetch fails                                     | ✅        |
| TASK-040b | Test pendingComponent displays during profile data load                                  | ✅        |

**Testing for Phase 4:**

- Test redirect to sign-in when unauthenticated
- Test loader function fetches profile correctly
- Test pending state displays during data load
- Test errorComponent catches and displays profile fetch errors
- Test pendingComponent shows loading UI
- Update all Account component tests

---

### Phase 5: Team Context Routes (Create Team)

**GOAL-005**: Migrate the `/create-team` route with `requireNoTeam` guard to prevent users with teams from accessing it.

| Task     | Description                                                                              | Completed |
| -------- | ---------------------------------------------------------------------------------------- | --------- |
| TASK-041 | Define no-team layout route in route tree with `requireNoTeam` guard in `beforeLoad`     | ✅        |
| TASK-042 | Define create-team route (`/create-team`) as child of no-team layout with errorComponent | ✅        |
| TASK-045 | Remove manual `useEffect` data fetching from CreateTeam component                        | ✅        |
| TASK-046 | Update team creation submission to use type-safe navigation                              | ✅        |
| TASK-047 | Add pending component for create team page                                               | ✅        |
| TASK-048 | Test redirect to team page if user already has team                                      | ✅        |
| TASK-050 | Update CreateTeam component tests to mock loader data                                    | ✅        |

**Testing for Phase 5:**

- Route guard redirects users with teams (tested in Phase 2 route guard tests)
- Complete team creation flow (covered in CreateTeam component tests)
- All CreateTeam component tests pass

**Phase 5 Notes:**

- CreateTeam component only requires team name input currently
- No loader needed at this stage
- Pool data (drivers/constructors) will be added when selection UI is implemented in future phases

---

### Phase 6: Team-Required Routes (Leagues)

**GOAL-006**: Migrate routes requiring a team (`/leagues` and `/league/:leagueId`) with type-safe parameters and data loading.

| Task     | Description                                                                                     | Completed |
| -------- | ----------------------------------------------------------------------------------------------- | --------- |
| TASK-051 | Define team-required layout route in route tree with `requireTeam` guard in `beforeLoad`        | ✅        |
| TASK-052 | Define leagues route (`/leagues`) as child of team-required layout with errorComponent          | ✅        |
| TASK-053 | Add loader function to leagues route to fetch user's leagues before rendering                   | ✅        |
| TASK-054 | Update LeagueList component to use `useLoaderData()` instead of `useAsyncData` hook             | ✅        |
| TASK-055 | Define league detail route (`/league/$leagueId`) with typed params using Zod and errorComponent | ✅        |
| TASK-056 | Add loader function to league detail route to fetch league by ID with automatic type conversion | ✅        |
| TASK-057 | Update League component to use `useLoaderData()` and `useParams()` with types                   | ✅        |
| TASK-058 | Remove manual `Number(params.leagueId)` conversions (now type-safe)                             | ✅        |
| TASK-059 | Add pending components for league list and league detail routes                                 | ✅        |
| TASK-060 | Update navigation links to use type-safe `Link` component with typed params                     | ✅        |
| TASK-061 | Test redirect to `/create-team` if user has no team                                             | ✅        |
| TASK-062 | Test league list loader fetches all user leagues                                                | ✅        |
| TASK-063 | Test league detail loader with invalid league ID returns 404                                    | ⚠️        |
| TASK-064 | Update LeagueList and League component tests to mock loader data                                | ✅        |

**Testing for Phase 6:**

- Test `requireTeam` guard redirects teamless users
- Test league list loader returns proper data structure
- Test league detail loader with valid ID
- Test league detail loader with invalid ID (404 handling)
- Test type-safe params in League component
- Test errorComponent handles fetch failures
- Test pendingComponent shows loading states
- Test loader cache prevents duplicate fetches
- Update all league-related component tests

---

### Phase 7: Team Routes with Type-Safe Parameters

**GOAL-007**: Migrate the `/team/:teamId` route with fully type-safe parameters and preloaded team data.

| Task     | Description                                                                         | Completed |
| -------- | ----------------------------------------------------------------------------------- | --------- |
| TASK-065 | Define team detail route (`/team/$teamId`) with typed params using Zod              | ✅        |
| TASK-066 | Add loader function to team route to fetch team details by ID before rendering      | ✅        |
| TASK-067 | Update Team component to use `useLoaderData()` for team data                        | ✅        |
| TASK-068 | Remove manual `useEffect` and state management from Team component                  | ✅        |
| TASK-069 | Add Zod schema validation for teamId parameter (number validation)                  | ✅        |
| TASK-070 | Update navigation to team pages to use type-safe params                             | ✅        |
| TASK-071 | Add pending component for team detail page                                          | ✅        |
| TASK-072 | Add errorComponent to route definition for team not found and fetch error scenarios | ✅        |
| TASK-073 | Test team loader with valid team ID                                                 | ✅        |
| TASK-074 | Test team loader with invalid team ID returns 404                                   | ✅        |
| TASK-075 | Test parameter validation catches non-numeric IDs                                   | ✅        |
| TASK-076 | Update Team component tests to mock loader data                                     | ✅        |

**Testing for Phase 7:**

- Test loader fetches team data before render
- Test type-safe params eliminate `Number()` conversions
- Test Zod validation for teamId param
- Test error handling for non-existent teams
- Test errorComponent displays for fetch errors
- Test pending state during team data load
- Test pendingComponent shows loading UI
- Test navigation cancellation with slow loaders
- Update Team component tests with loader mocks

---

### Phase 8: Remove Legacy Code and Dependencies

**GOAL-008**: Clean up React Router v7 code, remove unused hooks, and update all imports to TanStack Router.

| Task      | Description                                                            | Completed |
| --------- | ---------------------------------------------------------------------- | --------- |
| TASK-077  | Remove `useAsyncData` hook from codebase (no longer needed)            | ✅        |
| TASK-078  | Delete `ProtectedRoute` component (replaced by `beforeLoad` guards)    | ✅        |
| TASK-079  | Delete `NoTeamGuard` component (replaced by `requireNoTeam` guard)     | ✅        |
| TASK-080  | Delete `TeamRequiredGuard` component (replaced by `requireTeam` guard) | ✅        |
| TASK-081  | Delete `routeHelpers.tsx` and `withProtection` HOC (no longer needed)  | ✅        |
| TASK-082  | Remove all React Router imports from components                        | ✅        |
| TASK-083  | Update all navigation to use TanStack Router hooks                     | ✅        |
| TASK-084  | Remove React Router v7 from `package.json` dependencies                | ✅        |
| TASK-085  | Run full test suite to verify all tests pass                           | ✅        |
| TASK-086  | Run linter to catch any remaining React Router imports                 | ✅        |
| TASK-086a | Run memory profiler to verify no leaks from old router remain          | ⚠️        |
| TASK-086b | Verify all error boundaries converted to errorComponent pattern        | ✅        |
| TASK-086c | Remove temporary redirect logic from CreateTeam component              | ✅        |

**Phase 8 Notes:**

- TASK-082/083 were already completed in prior phases - all components use `@tanstack/react-router`
- TASK-086a (memory profiling) is optional manual tooling work, deferred
- TASK-086c was not needed - CreateTeam had no temporary redirect logic
- All 495 tests pass, linter clean, TypeScript build successful
- `react-router` v7.8.0 removed from dependencies (3 packages removed)

**Testing for Phase 8:**

- Run full test suite: `npm test`
- Run test coverage: `npm run test:coverage`
- Run linter: `npm run lint`
- Run TypeScript compiler: `tsc --noEmit`
- Memory profiling: verify no router-related leaks
- Pattern verification: confirm errorComponent usage throughout
- Manual testing: verify all routes work correctly

---

### Phase 9: Documentation and Performance Validation

**GOAL-009**: Update documentation, validate performance improvements, and ensure all success criteria are met.

| Task     | Description                                                   | Completed |
| -------- | ------------------------------------------------------------- | --------- |
| TASK-087 | Update `architecture.md` with TanStack Router patterns        | ✅        |
| TASK-088 | Update `testing.md` with loader and guard testing patterns    | ✅        |
| TASK-089 | Update `.github/copilot-instructions.md` with router guidance | ✅        |
| TASK-090 | Document loader pattern with code examples                    | ✅        |
| TASK-091 | Document `beforeLoad` guard pattern with examples             | ✅        |

**Phase 9 Notes:**

- All documentation files updated to reflect TanStack Router patterns
- React Router v7 references replaced with TanStack Router throughout
- Loader pattern documented with Zod validation and SWR caching examples
- Route guard patterns documented with `beforeLoad` and `throw redirect()` patterns
- Testing patterns added for mocking loaders, guards, and router hooks

**Testing for Phase 9:**

- ✅ All 495 tests pass
- ✅ ESLint clean (no errors)
- ✅ TypeScript build successful
- ✅ Review all documentation for accuracy

---

## 3. Alternatives

### ALT-001: Keep React Router v7 and add TanStack Query

**Why Not Chosen**: TanStack Router includes built-in data loading with SWR caching that eliminates the need for a separate data fetching library. This approach adds unnecessary complexity (two libraries instead of one) and doesn't solve the type safety issues with route params.

### ALT-002: Use Next.js App Router

**Why Not Chosen**: Would require complete application rewrite including server-side rendering setup, which is overkill for this client-side application. Migration complexity far exceeds benefits for current requirements.

### ALT-003: Build custom type-safe wrapper around React Router v7

**Why Not Chosen**: Reinventing the wheel when TanStack Router already provides production-ready solutions. Maintenance burden of custom routing layer is not justified when proven library exists.

### ALT-004: Use Remix framework

**Why Not Chosen**: Remix requires server-side rendering infrastructure and is designed for full-stack applications. Current application is client-side only with separate API, making Remix's architecture misaligned with project needs.

### ALT-005: Incremental migration using React Router v7's data APIs

**Why Not Chosen**: React Router v7 data APIs still lack the type safety guarantees that TanStack Router provides. Params and search params remain loosely typed, which is a primary pain point to solve.

---

## 4. Dependencies

### External Dependencies

- **DEP-001**: `@tanstack/react-router` (latest stable v1.x) - Core routing library
- **DEP-002**: `@tanstack/router-devtools` - Development tools for debugging routes
- **DEP-003**: Zod (already in project) - Route params validation

### Internal Dependencies

- **DEP-005**: `AuthContext` - Must provide user and loading state to router context
- **DEP-006**: `TeamContext` - Must provide team state to router context
- **DEP-007**: All service functions (`leagueService`, `teamService`, etc.) - Used in loaders
- **DEP-008**: Sentry integration - Must be configured for TanStack Router performance tracking
- **DEP-009**: Error boundary components - Must integrate with route-level errors

### Development Dependencies

- **DEP-010**: TypeScript 5.8.3 - For type inference and validation
- **DEP-011**: Vitest - Test runner for all new tests
- **DEP-012**: React Testing Library - Component testing framework
- **DEP-013**: @testing-library/user-event - User interaction testing

---

## 5. Files

### New Files to Create

- **FILE-001**: `src/router.tsx` - Router instance, root route, and all route definitions
- **FILE-002**: `src/lib/router-context.ts` - Router context type definitions
- **FILE-003**: `src/lib/route-guards.ts` - Reusable guard functions
- **FILE-004**: `src/lib/route-params-schemas.ts` - Zod schemas for route params validation

### Files to Modify

- **FILE-005**: `src/main.tsx` - Replace BrowserRouter with RouterProvider
- **FILE-006**: `package.json` - Update dependencies (add TanStack Router, remove React Router)
- **FILE-021**: `src/components/League/League.tsx` - Use loader data instead of useEffect
- **FILE-022**: `src/components/LeagueList/LeagueList.tsx` - Use loader data
- **FILE-023**: `src/components/Team/Team.tsx` - Use loader data and typed params
- **FILE-024**: `src/components/CreateTeam/CreateTeam.tsx` - Use loader data
- **FILE-025**: `src/components/Account/Account.tsx` - Use loader data
- **FILE-026**: `src/components/auth/SignInForm/SignInForm.tsx` - Use TanStack Router navigation
- **FILE-027**: `src/components/auth/SignUpForm/SignUpForm.tsx` - Use TanStack Router navigation
- **FILE-028**: `.github/copilot-instructions.md` - Update routing documentation
- **FILE-029**: `.github/instructions/architecture.md` - Update routing patterns
- **FILE-030**: `.github/instructions/testing.md` - Add loader testing guidance

### Files to Delete

- **FILE-017**: `src/hooks/useAsyncData.ts` - Replaced by loader functions
- **FILE-018**: `src/utils/routeHelpers.tsx` - Replaced by beforeLoad guards
- **FILE-019**: `src/components/auth/ProtectedRoute/ProtectedRoute.tsx` - No longer needed
- **FILE-020**: `src/components/NoTeamGuard/NoTeamGuard.tsx` - Replaced by guard function
- **FILE-021**: `src/components/TeamRequiredGuard/TeamRequiredGuard.tsx` - Replaced by guard function
- **FILE-022**: `src/components/auth/ProtectedRoute/ProtectedRoute.test.tsx` - Associated test file
- **FILE-023**: `src/components/NoTeamGuard/NoTeamGuard.test.tsx` - Associated test file
- **FILE-024**: `src/components/TeamRequiredGuard/TeamRequiredGuard.test.tsx` - Associated test file

---

## 6. Testing

### Unit Tests

- **TEST-001**: Test `requireAuth` guard redirects to `/sign-in` when not authenticated
- **TEST-002**: Test `requireAuth` guard allows access when authenticated
- **TEST-003**: Test `requireTeam` guard redirects to `/create-team` when no team
- **TEST-004**: Test `requireTeam` guard allows access when team exists
- **TEST-005**: Test `requireNoTeam` guard redirects to team page when team exists
- **TEST-006**: Test `requireNoTeam` guard allows access when no team
- **TEST-007**: Test league list loader fetches leagues correctly
- **TEST-008**: Test league detail loader fetches league by ID
- **TEST-009**: Test team loader fetches team by ID
- **TEST-010**: Test create team loader fetches pool data
- **TEST-011**: Test account loader fetches user profile
- **TEST-012**: Test search params Zod validation accepts valid params
- **TEST-013**: Test search params validation rejects invalid params
- **TEST-014**: Test loader error handling returns proper error objects

### Integration Tests

- **TEST-015**: Test complete sign-in flow with TanStack Router navigation
- **TEST-016**: Test complete sign-up flow with profile creation and navigation
- **TEST-017**: Test team creation flow end-to-end with pool data loading
- **TEST-018**: Test league list to league detail navigation flow
- **TEST-019**: Test team detail page with valid team ID
- **TEST-020**: Test redirect flow for unauthenticated users accessing protected routes
- **TEST-021**: Test redirect flow for users without teams accessing team-required routes
- **TEST-022**: Test redirect flow for users with teams accessing create team route
- **TEST-023**: Test browser back/forward navigation with cached data
- **TEST-024**: Test error boundaries catch and display loader errors

### Component Tests

- **TEST-025**: Update League component tests to mock `useLoaderData` hook
- **TEST-026**: Update LeagueList component tests to mock loader data
- **TEST-027**: Update Team component tests to mock loader data and typed params
- **TEST-028**: Update CreateTeam component tests to mock pool loader
- **TEST-029**: Update Account component tests to mock profile loader
- **TEST-030**: Update SignInForm tests to use mocked router navigation
- **TEST-031**: Update SignUpForm tests to use mocked router navigation
- **TEST-032**: Test pending components display during loader execution
- **TEST-033**: Test error fallback components display on loader errors

### Performance Tests

- **TEST-034**: Measure time-to-interactive for league list route
- **TEST-035**: Measure time-to-interactive for league detail route
- **TEST-036**: Verify data preloading occurs on link hover
- **TEST-037**: Verify route transitions are instant with cached data
- **TEST-038**: Compare bundle size before and after migration
- **TEST-039**: Verify no memory leaks during route transitions

### Accessibility Tests

- **TEST-040**: Verify keyboard navigation works on all routes
- **TEST-041**: Test screen reader announces route changes
- **TEST-042**: Test loading states have proper `role="status"` attributes
- **TEST-043**: Test error states have proper `role="alert"` attributes
- **TEST-044**: Verify focus management during navigation

---

## 7. Risks & Assumptions

### Risks

- **RISK-001**: **High Complexity** - Migrating all routes simultaneously is complex and error-prone
  - _Mitigation_: Use phased approach starting with simple public routes before tackling complex authenticated routes
- **RISK-002**: **Breaking Changes** - Component interfaces will change when switching from React Router hooks to TanStack Router hooks
  - _Mitigation_: Comprehensive test coverage and systematic migration phase by phase
- **RISK-003**: **Team Learning Curve** - Team must learn TanStack Router patterns and file-based routing
  - _Mitigation_: Detailed documentation, code examples, and gradual migration allows learning over time
- **RISK-004**: **Auth Context Integration** - Providing auth state to router context may require refactoring
  - _Mitigation_: Design router context interface early (Phase 2) and validate with tests before proceeding
- **RISK-005**: **Test Coverage** - Large number of tests need updating to mock loader functions
  - _Mitigation_: Update tests phase by phase alongside route migration, not as separate phase
- **RISK-006**: **Sentry Integration** - Performance monitoring may require reconfiguration
  - _Mitigation_: Configure Sentry integration in Phase 1 before migrating routes
- **RISK-007**: **Type System Complexity** - Advanced TypeScript features in TanStack Router may cause compilation issues
  - _Mitigation_: Use TypeScript 5.8.3 with proper tsconfig settings, consult TanStack Router docs for type issues

### Assumptions

- **ASSUMPTION-001**: TanStack Router's built-in caching will be sufficient for application needs (no TanStack Query required)
- **ASSUMPTION-002**: Current API service layer (`leagueService`, `teamService`, etc.) can be used directly in loader functions without modification
- **ASSUMPTION-003**: Authentication tokens are available synchronously from AuthContext for guard functions
- **ASSUMPTION-004**: Team context state can be provided to router context without circular dependencies
- **ASSUMPTION-005**: File-based routing structure aligns well with current route organization
- **ASSUMPTION-006**: Existing error boundaries can integrate with TanStack Router's error handling
- **ASSUMPTION-007**: Vite plugin will generate route tree correctly on first run
- **ASSUMPTION-008**: No backend API changes are required for this migration
- **ASSUMPTION-009**: All environment variables remain unchanged
- **ASSUMPTION-010**: Sentry will capture errors from loader functions without additional configuration

---

## 8. Related Specifications / Further Reading

### Official TanStack Router Documentation

- [TanStack Router Documentation](https://tanstack.com/router/latest) - Main documentation hub
- [Quick Start Guide](https://tanstack.com/router/latest/docs/framework/react/quick-start) - Getting started with TanStack Router
- [Code-Based Routing](https://tanstack.com/router/latest/docs/framework/react/guide/code-based-routing) - Defining routes in code (used in this migration)
- [Type Safety Guide](https://tanstack.com/router/latest/docs/framework/react/guide/type-safety) - Comprehensive type safety patterns
- [Data Loading Guide](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading) - Loader functions and data fetching
- [Authenticated Routes Pattern](https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes) - Authentication guard patterns
- [File-Based Routing](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing) - Optional: can migrate to file-based routing later

### Migration Resources

- [Migration from React Router Guide](https://tanstack.com/router/latest/docs/framework/react/installation/migrate-from-react-router) - Official migration guide
- [External Data Loading Integration](https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading) - For TanStack Query integration if needed later

### Project-Specific Documentation

- [Issue #26: Migrate to TanStack Router](https://github.com/emsqrd/f1-companion/issues/26) - Original feature request with requirements
- [Issue #25: TanStack Query Migration](https://github.com/emsqrd/f1-companion/issues/25) - Related issue (may be obsolete after this migration)
- `src/README.md` - Project overview and architecture (to be updated)
- `.github/instructions/architecture.md` - Architecture patterns (to be updated with router patterns)
- `.github/instructions/testing.md` - Testing guidelines (to be updated with loader test patterns)

### Related Technologies

- [React 19 Documentation](https://react.dev) - For React 19-specific features
- [Zod Documentation](https://zod.dev) - For search params validation schemas
- [Vite Documentation](https://vite.dev) - For build configuration
- [Vitest Documentation](https://vitest.dev) - For testing patterns

---

## Success Criteria Checklist

The migration will be considered successful when all of the following criteria are met:

- ✅ **Type Safety**: All route params are fully typed (no more `Number()` conversions)
- ✅ **Data Loading**: Route-level data loading with loaders eliminates manual `useEffect` patterns
- ✅ **Guard Logic**: Guard logic is declarative using `beforeLoad` (no nested HOCs)
- ✅ **Tests**: All tests pass with updated routing patterns
- ✅ **Performance**: No performance regressions (improvements with preloading)
- ✅ **Documentation**: Documentation and Copilot instructions updated
- ✅ **Clean Code**: React Router v7 fully removed from dependencies
- ✅ **Evaluation**: Assessment completed on whether additional data fetching libraries are needed

---

## Post-Migration Evaluation

After completing this migration, conduct the following evaluation:

1. **Data Fetching Assessment**: Evaluate if TanStack Router's built-in caching is sufficient or if TanStack Query provides additional value for:
   - Background refetching patterns
   - Optimistic updates
   - Complex cache invalidation scenarios
   - Global loading states

2. **Client State Management**: Assess if Zustand is needed for:
   - Client-only UI state (modals, forms, temporary data)
   - State that doesn't belong in URL (search params)
   - Cross-route state persistence

3. **Performance Monitoring**: Analyze Sentry performance data to validate:
   - Route transition times improved
   - Data preloading reducing perceived load times
   - No new performance bottlenecks introduced

4. **Developer Experience**: Gather team feedback on:
   - Type safety improvements
   - Ease of adding new routes
   - Debugging experience
   - Learning curve and documentation quality
