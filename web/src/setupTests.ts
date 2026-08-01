import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { API_BASE } from './mocks/handlers';
import { server } from './mocks/server';
import { installMatchMediaMock, setMobileViewport } from './tests/test-utils/matchMedia';

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

installMatchMediaMock();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(async () => {
  server.resetHandlers();
  setMobileViewport(false);

  // Imported lazily: a static import would evaluate `lib/supabase` before the
  // env stubs above run and would pin the real module ahead of per-file
  // `vi.mock('@/lib/supabase')` registrations.
  const authStore = await import('./lib/authStore');
  authStore.resetAuthStore();
});

afterAll(() => server.close());
