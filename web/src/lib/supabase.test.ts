import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the @supabase/supabase-js module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    supabaseUrl: 'mock-url',
    supabaseKey: 'mock-key',
  })),
}));

describe('supabase module initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear any existing environment variable mocks
    vi.unstubAllEnvs();
  });

  it('should throw error when VITE_SUPABASE_URL is missing', async () => {
    // Mock environment variables
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    await expect(async () => {
      await import('./supabase');
    }).rejects.toThrow('Missing required environment variable: VITE_SUPABASE_URL');
  });

  it('should throw error when VITE_SUPABASE_URL is undefined', async () => {
    // Don't set VITE_SUPABASE_URL at all (undefined)
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    // Explicitly stub the URL as undefined
    vi.stubEnv('VITE_SUPABASE_URL', undefined);

    await expect(async () => {
      await import('./supabase');
    }).rejects.toThrow('Missing required environment variable: VITE_SUPABASE_URL');
  });

  it('should throw error when VITE_SUPABASE_ANON_KEY is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    await expect(async () => {
      await import('./supabase');
    }).rejects.toThrow('Missing required environment variable: VITE_SUPABASE_ANON_KEY');
  });

  it('should throw error when VITE_SUPABASE_ANON_KEY is undefined', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    // Explicitly stub the anon key as undefined
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', undefined);

    await expect(async () => {
      await import('./supabase');
    }).rejects.toThrow('Missing required environment variable: VITE_SUPABASE_ANON_KEY');
  });

  it('should initialize successfully when both environment variables are present', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    const importPromise = async () => {
      const module = await import('./supabase');
      // Verify that the supabase client was created successfully
      expect(module.supabase).toBeDefined();
      expect(typeof module.supabase).toBe('object');
    };

    await expect(importPromise()).resolves.not.toThrow();
  });

  it('should call createClient with correct parameters when both env vars are present', async () => {
    const { createClient } = await import('@supabase/supabase-js');

    vi.stubEnv('VITE_SUPABASE_URL', 'https://myproject.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'my-anon-key');

    await import('./supabase');

    expect(createClient).toHaveBeenCalledWith('https://myproject.supabase.co', 'my-anon-key');
  });
});
