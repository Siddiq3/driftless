import { ApiError } from '@/api/client';

/** A failed operation is retried by the user, never by recreating an existing account. */
export function bootstrapFailure(error: unknown) {
  if (!(error instanceof ApiError))
    return {
      code: 'local_initialization',
      retryable: true,
      message:
        'Account preparation could not finish. Your phone data is retained. Retry to resume.',
    };
  const code = error.code;
  if (['credential_timeout', 'credential_unavailable'].includes(code))
    return {
      code,
      retryable: true,
      message:
        'Google session restoration could not finish. Check your connection and Retry. Your phone data is retained.',
    };
  if (error.status === 401)
    return {
      code,
      retryable: true,
      message: 'Your Google session needs refreshing. Retry, or sign out and sign in again.',
    };
  if (code === 'contract_mismatch')
    return {
      code,
      retryable: false,
      message:
        'The account response is incompatible with this app. Update the app or contact support.',
    };
  if (['account_inactive', 'registration_conflict'].includes(code))
    return {
      code,
      retryable: true,
      message: 'Account status changed. Retry to check its current status.',
    };
  if (code === 'profile_missing')
    return {
      code,
      retryable: false,
      message:
        'The active account profile is missing. Contact support; your account has not been reset.',
    };
  if (error.offline || error.status === 429 || (error.status ?? 0) >= 500)
    return {
      code,
      retryable: true,
      message:
        'The account service is temporarily unavailable. Retry to resume. Your phone data is retained.',
    };
  return {
    code,
    retryable: false,
    message: `Account preparation was refused (${code}). Sign in again or contact support.`,
  };
}
