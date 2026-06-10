import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { API_BASE } from './mocks/handlers';
import { server } from './mocks/server';

// Re-exported so existing tests can import `API_BASE` / `server` from
// `@/setupTests`; the shared default handlers live in `mocks/`.
export { API_BASE } from './mocks/handlers';
export { server } from './mocks/server';

vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('VITE_F1_FANTASY_API', API_BASE);

// Mock ResizeObserver for Radix UI components
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = MockResizeObserver;

let mobileViewport = false;

/**
 * Drives `useIsMobile()` in tests by setting whether `matchMedia` reports the
 * mobile breakpoint as matching. The `change` listeners are no-ops, so flip
 * this before mount, not mid-render.
 */
export function setMobileViewport(value: boolean): void {
  mobileViewport = value;
}

// jsdom has no `matchMedia`. Report the mobile breakpoint query against the
// `mobileViewport` flag (everything else, e.g. `next-themes`'s color-scheme
// query, stays unmatched).
window.matchMedia = ((query: string): MediaQueryList =>
  ({
    matches: query.includes('max-width') ? mobileViewport : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList) as typeof window.matchMedia;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  mobileViewport = false;

  // Imported lazily: a static import would evaluate `lib/supabase` before the
  // env stubs above run and would pin the real module ahead of per-file
  // `vi.mock('@/lib/supabase')` registrations. The catch covers suites that
  // deliberately break the supabase env (supabase.test.ts) — if the module
  // graph can't load, there is no store instance to reset.
  const authStore = await import('./lib/authStore').catch(() => null);
  authStore?.resetAuthStore();
});

afterAll(() => server.close());
