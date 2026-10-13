import {
  AuthInvalidJwtError,
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  type AuthError,
} from "@supabase/supabase-js";

export class AuthServiceUnavailableError extends Error {
  constructor() {
    super("Authentication service is temporarily unavailable.");
    this.name = "AuthServiceUnavailableError";
  }
}

export function isAuthServiceUnavailableError(
  error: unknown,
): error is AuthServiceUnavailableError {
  return error instanceof AuthServiceUnavailableError;
}

export function isUnauthenticatedAuthError(error: AuthError | null): boolean {
  return error !== null && (
    isAuthSessionMissingError(error) ||
    error instanceof AuthInvalidJwtError ||
    (isAuthApiError(error) && (error.status === 401 || error.status === 403))
  );
}

export function shouldDeferAuthError(error: AuthError | null): boolean {
  return error !== null && (
    isAuthRetryableFetchError(error) || isUnauthenticatedAuthError(error)
  );
}
