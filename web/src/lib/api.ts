import type { ApiError } from '@/utils/errors';
import * as Sentry from '@sentry/react';

import { getAuthSnapshot } from './authStore';
import { supabase } from './supabase';

type RequestConfig<D = unknown> = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  data?: D;
  headers?: HeadersInit;
  errorContext?: string; // Optional context for error messages (e.g., "get leagues", "create team")
};

class ApiClient {
  private baseUrl: string;

  constructor() {
    const envBaseUrl = import.meta.env.VITE_F1_FANTASY_API;
    if (!envBaseUrl) {
      throw new Error(
        'VITE_F1_FANTASY_API environment variable is not set. Please configure it in your environment.',
      );
    }
    this.baseUrl = envBaseUrl;
  }

  private async getBaseHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Another tab may have just signed this user in (e.g. a password reset).
    // The Supabase session read above may not reflect that in this tab yet,
    // so fall back to our auth store. Supabase goes first because it
    // refreshes an expired token.
    const accessToken = session?.access_token ?? getAuthSnapshot().session?.access_token;

    return {
      'Content-Type': 'application/json',
      ...(accessToken && {
        Authorization: `Bearer ${accessToken}`,
      }),
    };
  }

  private async makeRequest<T, D = unknown>(
    endpoint: string,
    config: RequestConfig<D> = {},
  ): Promise<T> {
    const { method = 'GET', data, headers: customHeaders, errorContext } = config;
    const baseHeaders = await this.getBaseHeaders();

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: { ...baseHeaders, ...customHeaders },
        ...(data && method !== 'GET' && { body: JSON.stringify(data) }),
      });

      if (!response.ok) {
        let errorBody = 'Unable to read response body';
        let bodyReadFailed = false;

        try {
          errorBody = await response.text();
        } catch (bodyError) {
          bodyReadFailed = true;
          Sentry.logger.error(
            Sentry.logger.fmt`Failed to read response body for ${method} ${endpoint}`,
            {
              endpoint,
              method,
              status: response.status,
              responseBody: 'Unable to read response body',
              error: bodyError instanceof Error ? bodyError.message : 'Unknown error',
            },
          );
        }

        // Only a problem+json body is a Problem Details document (RFC 9457 §3);
        // an error status alone doesn't guarantee one.
        let errorMessage = `${method} ${endpoint} failed: ${response.statusText}`;
        if (response.headers.get('content-type')?.includes('application/problem+json')) {
          try {
            const problemDetails: unknown = JSON.parse(errorBody);
            if (
              typeof problemDetails === 'object' &&
              problemDetails !== null &&
              'detail' in problemDetails &&
              typeof problemDetails.detail === 'string'
            ) {
              errorMessage = problemDetails.detail;
            }
          } catch {
            // Malformed problem+json body — fall back to statusText
          }
        }

        const error = new Error(errorMessage) as ApiError;
        error.status = response.status;
        error.responseBody = errorBody;

        // Capture 5xx server errors to Sentry
        if (response.status >= 500) {
          Sentry.withScope((scope) => {
            scope.setTag('api.endpoint', endpoint);
            scope.setTag('api.method', method);
            scope.setTag('error.type', 'server');
            scope.setContext('response', {
              status: response.status,
              statusText: response.statusText,
              body: errorBody,
              bodyReadFailed,
            });

            Sentry.logger.error(
              Sentry.logger.fmt`API server error: ${method} ${endpoint} (${response.status})`,
              {
                status: response.status,
                endpoint,
                method,
                responseBody: errorBody,
              },
            );

            Sentry.captureException(error);
          });
        }

        throw error;
      }

      // Handle empty responses (204 No Content or empty body)
      const contentLength = response.headers.get('content-length');
      const contentType = response.headers.get('content-type');

      if (
        response.status === 204 ||
        contentLength === '0' ||
        !contentType?.includes('application/json')
      ) {
        return null as T;
      }

      // Use response.json() directly for efficient parsing
      // This handles empty body errors gracefully
      try {
        return (await response.json()) as T;
      } catch {
        // If JSON parsing fails (empty body or invalid JSON), return null
        return null as T;
      }
    } catch (error) {
      // Capture network errors and other exceptions
      if (error instanceof Error && !('status' in error)) {
        // Create a more user-friendly error message
        const userMessage = errorContext
          ? `Failed to ${errorContext}`
          : `Failed to ${method.toLowerCase()} ${endpoint}`;

        const enhancedError = new Error(userMessage);
        // Preserve original error as cause for debugging
        enhancedError.cause = error;

        Sentry.withScope((scope) => {
          scope.setTag('api.endpoint', endpoint);
          scope.setTag('api.method', method);
          scope.setTag('error.type', 'network');
          if (errorContext) {
            scope.setTag('error.context', errorContext);
          }

          // Structured log for network errors
          Sentry.logger.error(Sentry.logger.fmt`API network error: ${method} ${endpoint}`, {
            error: error.message,
            endpoint,
            method,
            errorContext,
          });

          Sentry.captureException(enhancedError);
        });

        throw enhancedError;
      }

      throw error;
    }
  }

  async get<T>(endpoint: string, errorContext?: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { errorContext });
  }

  async post<T, D = Record<string, unknown>>(
    endpoint: string,
    data?: D,
    errorContext?: string,
  ): Promise<T> {
    return this.makeRequest<T, D>(endpoint, { method: 'POST', data, errorContext });
  }

  async patch<T, D = Record<string, unknown>>(
    endpoint: string,
    data: D,
    errorContext?: string,
  ): Promise<T> {
    return this.makeRequest<T, D>(endpoint, { method: 'PATCH', data, errorContext });
  }

  async put<T, D = Record<string, unknown>>(
    endpoint: string,
    data: D,
    errorContext?: string,
  ): Promise<T> {
    return this.makeRequest<T, D>(endpoint, { method: 'PUT', data, errorContext });
  }

  async delete<T>(endpoint: string, errorContext?: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE', errorContext });
  }
}

export const apiClient = new ApiClient();
