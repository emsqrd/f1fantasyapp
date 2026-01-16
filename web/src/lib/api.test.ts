import * as Sentry from '@sentry/react';
import {
  type MockedFunction,
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { apiClient } from './api';
import { supabase } from './supabase';

// Mock Sentry
vi.mock('@sentry/react', () => ({
  withScope: vi.fn((callback) => callback({ setTag: vi.fn(), setContext: vi.fn() })),
  captureException: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    fmt: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
  },
}));

// Mock the supabase module
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('ApiClient', () => {
  const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
  const mockGetSession = vi.mocked(supabase.auth.getSession);

  beforeAll(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear Sentry mocks
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.logger.error).mockClear();
    vi.mocked(Sentry.logger.warn).mockClear();

    // Default session mock - no auth token
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('throws clear error when API URL is not configured', async () => {
      // Store original value
      const originalValue = import.meta.env.VITE_F1_FANTASY_API;

      // Mock the environment variable to be undefined
      vi.stubEnv('VITE_F1_FANTASY_API', undefined);

      // Reset modules to force fresh import
      vi.resetModules();

      try {
        // Verify developers get a helpful error message
        await expect(import('./api')).rejects.toThrow(
          'VITE_F1_FANTASY_API environment variable is not set. Please configure it in your environment.',
        );
      } finally {
        // Restore the original environment variable and reset modules
        vi.stubEnv('VITE_F1_FANTASY_API', originalValue);
        vi.resetModules();
      }
    });
  });

  describe('get method', () => {
    it('makes successful GET request without authentication', async () => {
      const mockResponseData = { id: 1, name: 'Test Data' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockResponseData),
        text: vi.fn().mockResolvedValue(JSON.stringify(mockResponseData)),
        headers: new Headers({ 'content-type': 'application/json' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const result = await apiClient.get('/test-endpoint');

      expect(result).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/test-endpoint'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('includes authorization header when user is authenticated', async () => {
      const mockResponseData = { id: 1, name: 'Authenticated Data' };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue(mockResponseData),
        text: vi.fn().mockResolvedValue(JSON.stringify(mockResponseData)),
      };
      const mockAccessToken = 'test-access-token';

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: mockAccessToken,
          },
        },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const result = await apiClient.get('/authenticated-endpoint');

      expect(result).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/authenticated-endpoint'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockAccessToken}`,
        },
      });
    });

    it('logs 4xx client errors as warnings without capturing exceptions', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: vi.fn().mockResolvedValue('Not found error body'),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      await expect(apiClient.get('/nonexistent-endpoint')).rejects.toThrow(
        'GET /nonexistent-endpoint failed: Not Found',
      );

      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(Sentry.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('API client error'),
        expect.objectContaining({
          status: 404,
          endpoint: '/nonexistent-endpoint',
          method: 'GET',
        }),
      );
    });

    it('captures network errors as exceptions with proper logging', async () => {
      const networkError = new Error('Network connection failed');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(apiClient.get('/network-error')).rejects.toThrow('Failed to get /network-error');

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to get /network-error',
          cause: networkError,
        }),
      );
      expect(Sentry.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('API network error'),
        expect.objectContaining({
          endpoint: '/network-error',
          method: 'GET',
        }),
      );
    });
  });

  describe('post method', () => {
    it('makes successful POST request with data', async () => {
      const postData = { name: 'New Item', description: 'Test description' };
      const mockResponseData = { id: 1, ...postData };
      const mockResponse = {
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue(mockResponseData),
        text: vi.fn().mockResolvedValue(JSON.stringify(mockResponseData)),
        headers: new Headers({ 'content-type': 'application/json' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const result = await apiClient.post('/create-item', postData);

      expect(result).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/create-item'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      });
    });

    it('makes POST request with authentication when user is signed in', async () => {
      const postData = { name: 'Authenticated Item' };
      const mockResponseData = { id: 2, ...postData };
      const mockResponse = {
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue(mockResponseData),
        text: vi.fn().mockResolvedValue(JSON.stringify(mockResponseData)),
        headers: new Headers({ 'content-type': 'application/json' }),
      };
      const mockAccessToken = 'authenticated-token';

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: mockAccessToken,
          },
        },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const result = await apiClient.post('/authenticated-create', postData);

      expect(result).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/authenticated-create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockAccessToken}`,
        },
        body: JSON.stringify(postData),
      });
    });

    it('logs POST request 4xx errors as warnings', async () => {
      const postData = { invalid: 'data' };
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue('Bad request error body'),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      await expect(apiClient.post('/bad-request', postData)).rejects.toThrow(
        'POST /bad-request failed: Bad Request',
      );

      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(Sentry.logger.warn).toHaveBeenCalled();
    });

    it('handles empty POST data', async () => {
      const mockResponseData = { success: true };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockResponseData),
        text: vi.fn().mockResolvedValue(JSON.stringify(mockResponseData)),
        headers: new Headers({ 'content-type': 'application/json' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const result = await apiClient.post('/empty-post', {});

      expect(result).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/empty-post'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
    });
  });

  describe('patch method', () => {
    it('makes successful PATCH request with data', async () => {
      const patchData = { name: 'Updated Name' };
      const mockResponseData = { id: 1, name: 'Updated Name', updated: true };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockResponseData),
        text: vi.fn().mockResolvedValue(JSON.stringify(mockResponseData)),
        headers: new Headers({ 'content-type': 'application/json' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const result = await apiClient.patch('/update-item/1', patchData);

      expect(result).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/update-item/1'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchData),
      });
    });

    it('makes PATCH request with authentication', async () => {
      const patchData = { status: 'active' };
      const mockResponseData = { id: 1, status: 'active' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockResponseData),
        text: vi.fn().mockResolvedValue(JSON.stringify(mockResponseData)),
        headers: new Headers({ 'content-type': 'application/json' }),
      };
      const mockAccessToken = 'patch-token';

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: mockAccessToken,
          },
        },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      const result = await apiClient.patch('/authenticated-update/1', patchData);

      expect(result).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/authenticated-update/1'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockAccessToken}`,
        },
        body: JSON.stringify(patchData),
      });
    });

    it('logs PATCH request 4xx errors as warnings', async () => {
      const patchData = { invalid: 'update' };
      const mockResponse = {
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: vi.fn().mockResolvedValue('Unprocessable entity error body'),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      await expect(apiClient.patch('/invalid-update/1', patchData)).rejects.toThrow(
        'PATCH /invalid-update/1 failed: Unprocessable Entity',
      );

      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(Sentry.logger.warn).toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    it('handles session retrieval errors gracefully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue('{}'),
        headers: new Headers({ 'content-type': 'application/json' }),
      };

      // Simulate session error
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session error' },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      // Should still work without auth token
      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/test'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('integration scenarios', () => {
    it('handles mixed authenticated and non-authenticated requests', async () => {
      const mockToken = 'test-token';

      // First request - no auth
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ public: true }),
        text: vi.fn().mockResolvedValue(JSON.stringify({ public: true })),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as unknown as Response);

      // Second request - with auth
      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: mockToken,
          },
        },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ private: true }),
        text: vi.fn().mockResolvedValue(JSON.stringify({ private: true })),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as unknown as Response);

      await apiClient.get('/public');
      await apiClient.get('/private');

      const [firstCall, secondCall] = mockFetch.mock.calls;

      expect(firstCall?.[1]).toEqual({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(secondCall?.[1]).toEqual({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockToken}`,
        },
      });
    });
  });

  describe('server errors (5xx)', () => {
    it('captures 500 server errors as exceptions with full context', async () => {
      const errorBody = 'Internal Server Error';
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue(errorBody),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      await expect(apiClient.get('/server-error')).rejects.toThrow(
        'GET /server-error failed: Internal Server Error',
      );

      expect(Sentry.captureException).toHaveBeenCalled();
      expect(Sentry.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('API server error'),
        expect.objectContaining({
          status: 500,
          endpoint: '/server-error',
          method: 'GET',
        }),
      );
    });

    it('captures 503 Service Unavailable as exception', async () => {
      const mockResponse = {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: vi.fn().mockResolvedValue('Service temporarily unavailable'),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      await expect(apiClient.post('/unavailable', {})).rejects.toThrow();

      expect(Sentry.captureException).toHaveBeenCalled();
      expect(Sentry.logger.error).toHaveBeenCalled();
    });
  });

  describe('error handling edge cases', () => {
    it('handles error when reading response body fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockRejectedValue(new Error('Failed to read body')),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response);

      await expect(apiClient.get('/error-read')).rejects.toThrow(
        'GET /error-read failed: Internal Server Error',
      );

      expect(Sentry.logger.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          responseBody: 'Unable to read response body',
        }),
      );
    });

    it('handles empty response body (204 No Content)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: vi.fn().mockResolvedValue(null),
        text: vi.fn().mockResolvedValue(''),
        headers: new Headers({ 'content-length': '0' }),
      } as unknown as Response);

      const result = await apiClient.get('/empty-response');
      expect(result).toBeNull();
    });

    it('handles empty response body with whitespace', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('   '),
        headers: new Headers({ 'content-type': 'application/json', 'content-length': '3' }),
      } as unknown as Response);

      const result = await apiClient.get('/whitespace');
      expect(result).toBeNull();
    });

    it('handles non-JSON content type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('<html>Not JSON</html>'),
        headers: new Headers({ 'content-type': 'text/html' }),
      } as unknown as Response);

      const result = await apiClient.get('/html');
      expect(result).toBeNull();
    });
  });
});
