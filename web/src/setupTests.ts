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

export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
