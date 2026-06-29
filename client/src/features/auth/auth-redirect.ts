const AUTH_QUERY_KEYS = ["code", "error", "error_code", "error_description", "access_token", "refresh_token"];
const AUTH_HASH_KEYS = ["access_token", "refresh_token", "error", "error_description"];

export function resolveAuthRedirectTarget(searchParams: URLSearchParams, hash: string) {
  const nextQuery = searchParams.toString();
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  const hasAuthParams =
    AUTH_QUERY_KEYS.some((key) => searchParams.has(key)) ||
    AUTH_HASH_KEYS.some((key) => hashParams.has(key));

  if (!hasAuthParams) {
    return "/login";
  }

  return `/auth/callback${nextQuery ? `?${nextQuery}` : ""}${hash}`;
}

export function isRecoverableOAuthError(errorCode: string | null, errorMessage: string | null) {
  const normalizedMessage = (errorMessage ?? "").toLowerCase();
  return (
    errorCode === "bad_oauth_state" ||
    normalizedMessage.includes("oauth state not found or expired") ||
    normalizedMessage.includes("flow state not found") ||
    normalizedMessage.includes("flow state expired")
  );
}

export function getOAuthErrorFallbackMessage(errorCode: string | null, errorMessage: string | null) {
  if (isRecoverableOAuthError(errorCode, errorMessage)) {
    return "Google sign-in expired before EduFX could finish it. Please try again.";
  }

  return errorMessage ?? "Google sign-in could not be completed.";
}
