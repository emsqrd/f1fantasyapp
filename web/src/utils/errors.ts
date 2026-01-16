/**
 * Represents an API error with HTTP status code
 */
export interface ApiError extends Error {
  status: number;
  responseBody?: string;
}

/**
 * Type guard to check if an error is an ApiError with a status code
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof Error && 'status' in error && typeof (error as ApiError).status === 'number'
  );
}
