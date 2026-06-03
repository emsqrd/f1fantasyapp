import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

/**
 * Base URL the test suite's apiClient targets. Exported so MSW handlers in
 * integration tests can build full URLs from a single source of truth instead
 * of repeating the literal across every `server.use(...)`.
 */
export const API_BASE = 'http://localhost/api';

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

export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  mobileViewport = false;
});

afterAll(() => server.close());
