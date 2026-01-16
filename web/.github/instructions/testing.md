---
description: 'Testing philosophy, strategies, patterns, and best practices for React application test suites'
applyTo: '**/*.test.tsx, **/*.test.ts, **/*.spec.tsx, **/*.spec.ts'
---

# Testing Guidelines

## Testing Philosophy

### Documentation & Best Practices

When writing or reviewing tests, validate approaches against official documentation using the Context7 MCP server:

- **React Testing Library**: Resolve `/testing-library/react-testing-library` for RTL best practices, query priorities, and patterns
- **Vitest**: Resolve `/vitest-dev/vitest` for test runner features, mocking patterns, and configuration
- **React 19**: Resolve `/facebook/react` when testing React 19-specific features (new hooks, Server Components, Actions, etc.)
- **TanStack Router**: Resolve `/tanstack/router` for route loader testing, guard patterns, and router mocking

Consult these sources when:

- Implementing unfamiliar testing patterns
- Deciding between testing approaches (e.g., when to mock, query strategies)
- Troubleshooting test failures or flaky tests
- Ensuring alignment with current industry standards

### What to Test (High Value)

- Business logic specific to your component/service
- User-facing behavior and workflows
- Integration of validation/form/submission pipeline (not individual rules)
- Error handling and retry logic
- User feedback (toasts, error messages)
- State cleanup and reset behavior
- Data transformations (e.g., whitespace trimming)
- Edge cases, boundary values, and error conditions
- Asynchronous behavior with proper async/await patterns

### What NOT to Test (Low Value)

- Third-party library behavior (React Hook Form state management, Radix UI dialog mechanics)
- Framework internals (React re-rendering, effect timing)
- Language features (optional chaining `?.`, TypeScript type safety)
- Styling concerns (CSS classes, Tailwind utilities, required field indicators)
- Static JSX rendering (headings, labels present)
- Validation schema rules (test those in schema unit tests if needed)
- Default values from config objects (unless computed/conditional)
- Presentation details that rarely break

**Exception:** Configuration validation that provides **developer feedback** is valuable. Test that critical environment variables throw clear, helpful error messages when missing. Focus on the **error message quality**, not the configuration mechanism itself.

Examples:

- ✅ **Test this:** "Does missing `VITE_API_URL` throw a clear error with actionable guidance?"
- ❌ **Don't test:** "Does Vite correctly read `import.meta.env` values?"
- ❌ **Don't test:** "Does the constructor successfully instantiate when config is valid?"

Keep **one focused test** per critical configuration point that validates the error message helps developers debug misconfigurations.

## Testing Standards

### Framework & Tools

- **Test Runner**: Vitest
- **Component Testing**: React Testing Library
- **User Interactions**: `@testing-library/user-event` (not `fireEvent`)
- **Patterns**: React 19 best practices

### Test Structure

- **Naming**: Use behavior-focused, imperative test names consistently. Avoid starting test names with 'should'. Prefer action-oriented phrasing such as 'renders...', 'displays...', 'returns...', 'submits...', 'shows an error when...', etc.
- **File Naming**: `ComponentName.test.tsx` (co-located with components)
- **Organization**: Use `describe` blocks for grouping related tests
- **Pattern**: Follow AAA (Arrange, Act, Assert)
- **Isolation**: Use `beforeEach`/`afterEach` for proper test isolation

### Query Strategy

1. **Prefer semantic queries**: `getByRole`, `getByLabelText`, `getByText`
2. **Fallback to**: `data-testid` attributes when semantic queries aren't practical
3. **Test from user's perspective**: How would a user interact with this?
4. **Use `within()` for scoped queries**: When selecting elements inside a specific container

### Test Data Strategy

**Hardcoded strings in tests are acceptable** when:

- The data is mock data you control (defined in the test file)
- The strings represent what users actually see
- Tests serve as documentation of expected behavior

**Avoid hardcoding** when:

- Testing against production data that changes frequently
- Testing exact marketing copy that updates regularly
- The string is an implementation detail, not user-facing

**Example - Good:**

```typescript
const mockDrivers = [{ id: 1, firstName: 'Oscar', lastName: 'Piastri' }];

// Clear, documents expected behavior
expect(screen.getByRole('heading', { name: 'Oscar Piastri' })).toBeInTheDocument();
```

**Alternative - Reference mock data directly:**

```typescript
const expectedName = `${mockDrivers[0].firstName} ${mockDrivers[0].lastName}`;
expect(screen.getByRole('heading', { name: expectedName })).toBeInTheDocument();
```

Both approaches are valid. Prefer readability over DRY in tests.

### Mock Strategy

**What to Mock:**

- External dependencies (API services, network calls)
- Browser APIs not available in test environment
- Contexts when testing components in isolation
- Time-dependent code (`vi.useFakeTimers()`)

**What NOT to Mock:**

- Child components (per RTL philosophy: "The more your tests resemble the way your software is used, the more confidence they can give you")
- User interactions - use real events via `userEvent`
- State management within the component under test

**Mock Best Practices:**

- Use `vi.fn()` and `vi.mock()` for Vitest mocks
- Ensure mocks are deterministic and don't rely on external state
- Test both success and failure scenarios
- Keep mocks minimal - only mock what's necessary

### Test Utilities & Mock Factories

**Mock Factories** (Test Data Builder Pattern):

For objects used across multiple test files, use centralized mock factories from `@/test-utils`:

```typescript
import { createMockTeam, createMockTeamDriver } from '@/test-utils';

// Basic usage with defaults
const team = createMockTeam();

// Override specific properties
const customTeam = createMockTeam({
  name: 'McLaren Racing',
  drivers: [createMockTeamDriver({ lastName: 'Piastri' })],
});
```

**When to use factories:**

- Object used in 3+ test files
- Object has 4+ required fields
- Object structure changes frequently during development

**When to use inline mocks:**

- Test validates specific data structure
- Mock is unique to a single test
- Explicit values improve test readability

This pattern follows React Testing Library's maintainability principles and the Test Data Builder pattern endorsed by Kent C. Dodds.

### Coverage Configuration

- **Excludes**: `src/components/ui` (shadcn/ui), `src/contracts`, `src/demos`, config files
- **Setup**: Global test setup in `src/setupTests.ts` with `@testing-library/jest-dom`
- **Global Mocks**: `ResizeObserver` for Radix UI components

## Test Categories

### 1. User Interaction Tests

Test how users interact with your component:

```typescript
it('handles form submission when user clicks submit button', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  await user.type(screen.getByLabelText(/name/i), 'John Doe');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(mockSubmitFn).toHaveBeenCalledWith({ name: 'John Doe' });
});
```

### 2. Error Handling Tests

Test error states and error boundaries:

```typescript
it('displays error message when API call fails', async () => {
  mockService.getData.mockRejectedValue(new Error('API Error'));

  render(<MyComponent />);

  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

### 3. Asynchronous Behavior Tests

Test loading states and async operations using `findBy` queries for elements that appear asynchronously:

```typescript
it('shows loading state then loaded data', async () => {
  render(<MyComponent />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  expect(await screen.findByText(/data loaded/i)).toBeInTheDocument();
});
```

**Note:** Use `findBy` queries (which have built-in waiting) instead of wrapping `getBy` queries in `waitFor()`. Reserve `waitFor()` for more complex assertions that can't be expressed with `findBy` queries.

### 4. Accessibility Tests

Test keyboard navigation and ARIA attributes:

```typescript
it('allows keyboard navigation', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  await user.tab();
  expect(screen.getByRole('button')).toHaveFocus();
});
```

## Common Testing Patterns

### Testing Context Providers

```typescript
const wrapper = ({ children }) => (
  <AuthProvider>{children}</AuthProvider>
);

render(<MyComponent />, { wrapper });
```

### Testing Custom Hooks

```typescript
const { result } = renderHook(() => useMyHook(), { wrapper });
expect(result.current.value).toBe(expectedValue);
```

### Testing Navigation

```typescript
// Mock TanStack Router navigation
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});
```

### Testing Components with Loader Data

Route loaders are thin wrappers around service calls - they fetch data and return it. **Test loaders through E2E/integration tests**, not unit tests. For unit tests, mock `useLoaderData` to test component behavior with different data states.

**Why this approach?**

- Loaders are configuration, not complex business logic
- Service calls are already tested in service tests
- E2E tests verify the full flow: navigation → loader → component

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock TanStack Router hooks
const mockUseLoaderData = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: (opts: { from: string }) => mockUseLoaderData(opts),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('League', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoaderData.mockReturnValue({
      league: { id: 1, name: 'Test League' },
    });
  });

  it('displays league information from loader data', () => {
    render(<League />);
    expect(screen.getByRole('heading', { name: 'Test League' })).toBeInTheDocument();
  });

  it('renders different league data correctly', () => {
    mockUseLoaderData.mockReturnValue({
      league: { id: 2, name: 'Champions League' },
    });
    render(<League />);
    expect(screen.getByRole('heading', { name: 'Champions League' })).toBeInTheDocument();
  });
});
```

### Testing Route Guards

Route guards (`beforeLoad`) control access to routes. Like loaders, **test guards through E2E/integration tests** for the full redirect flow. For unit tests, test the guard functions directly or test components in isolation.

**Direct guard function testing:**

```typescript
import { requireAuth, requireTeam } from '@/lib/route-guards';
import { describe, expect, it, vi } from 'vitest';

describe('Route Guards', () => {
  it('requireAuth throws redirect when user is not authenticated', async () => {
    const context = { auth: { user: null, loading: false }, team: null };

    await expect(requireAuth(context)).rejects.toThrow();
  });

  it('requireAuth returns undefined when user is authenticated', async () => {
    const context = { auth: { user: { id: '1' }, loading: false }, team: null };

    const result = await requireAuth(context);
    expect(result).toBeUndefined();
  });

  it('requireTeam throws redirect when user has no team', async () => {
    const context = { auth: { user: { id: '1' }, loading: false }, team: null };

    await expect(requireTeam(context)).rejects.toThrow();
  });
});
```

### Mocking Route Loader Data

For component tests that consume loader data:

```typescript
import { vi } from 'vitest';

// Mock the route module to provide loader data
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    // Mock useLoaderData to return test data
    useLoaderData: () => ({
      league: { id: 1, name: 'Test League' },
    }),
    useParams: () => ({ leagueId: '1' }),
    useNavigate: () => vi.fn(),
  };
});
```

## Quick Test Generation Prompts

The testing instructions in this document will be automatically included in Copilot's context.

### For New Test Files

Use this prompt when creating tests for a file that doesn't have any tests yet:

```
Generate high-value tests for this file following our testing guidelines.
- Keep it lean (~10-15 tests)
- After writing tests, review for duplicate assertions or test cases
- Run all tests to ensure they pass
- Run the linter to ensure there are no linting errors
- Run the build to ensure no type errors
- Run code coverage and ensure that coverage is at an excellent level
- Verify all tests provide high value per our testing philosophy
```

### For Existing Test Files

Use this prompt when adding tests to cover new functionality in an existing test file:

```
Add tests for the new [describe feature/functionality] following our testing guidelines.
- Review existing tests to understand current coverage and patterns
- Add only tests for the new functionality, avoiding duplicates
- Follow the existing test file's naming conventions and organization
- Run tests to ensure they pass alongside existing tests
- Verify new tests cover the added functionality
```

## Essential Commands

```bash
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage reports
```

## Key Testing Principles

1. **Test behavior, not implementation** - Focus on what the user sees and does
2. **One integration path is enough** - Prove validation works; don't test every rule
3. **Meaningful coverage over 100%** - High-value tests matter more than coverage percentage
4. **Readable tests are maintainable** - Clear test names and assertions
5. **Isolation prevents flaky tests** - Each test should be independent
