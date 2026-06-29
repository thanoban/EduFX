type SessionLike = {
  access_token: string;
};

type SessionResponse = {
  data: {
    session: SessionLike | null;
  };
  error: {
    message: string;
  } | null;
};

type SetSessionPayload = {
  access_token: string;
  refresh_token: string;
};

type SupabaseAuthLike = {
  getSession: () => Promise<SessionResponse>;
  exchangeCodeForSession: (code: string) => Promise<SessionResponse>;
  setSession: (payload: SetSessionPayload) => Promise<SessionResponse>;
};

type SupabaseClientLike = {
  auth: SupabaseAuthLike;
};

type CallbackTokens = {
  accessToken: string | null;
  code: string | null;
  error: string | null;
  refreshToken: string | null;
};

export function normalizeErrorMessage(raw: string | null) {
  if (!raw) {
    return null;
  }

  return decodeURIComponent(raw.replace(/\+/g, " "));
}

export function readCallbackTokens(searchParams: URLSearchParams, hash: string): CallbackTokens {
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  const error =
    normalizeErrorMessage(searchParams.get("error_description")) ??
    normalizeErrorMessage(searchParams.get("error")) ??
    normalizeErrorMessage(hashParams.get("error_description")) ??
    normalizeErrorMessage(hashParams.get("error"));

  return {
    code: searchParams.get("code"),
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    error,
  };
}

export async function resolveCallbackAccessToken(
  searchParams: URLSearchParams,
  hash: string,
  supabaseClient: SupabaseClientLike,
  onHashTokensApplied?: () => void,
) {
  const callbackTokens = readCallbackTokens(searchParams, hash);
  if (callbackTokens.error) {
    return { accessToken: null, error: callbackTokens.error };
  }

  if (callbackTokens.code) {
    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(callbackTokens.code);
    if (error) {
      return { accessToken: null, error: error.message };
    }

    if (data.session?.access_token) {
      return { accessToken: data.session.access_token, error: null };
    }

    const fallbackSession = await supabaseClient.auth.getSession();
    if (fallbackSession.error) {
      return { accessToken: null, error: fallbackSession.error.message };
    }

    if (fallbackSession.data.session?.access_token) {
      return { accessToken: fallbackSession.data.session.access_token, error: null };
    }
  }

  if (callbackTokens.accessToken && callbackTokens.refreshToken) {
    const { data, error } = await supabaseClient.auth.setSession({
      access_token: callbackTokens.accessToken,
      refresh_token: callbackTokens.refreshToken,
    });
    if (error) {
      return { accessToken: null, error: error.message };
    }

    onHashTokensApplied?.();
    return {
      accessToken: data.session?.access_token ?? callbackTokens.accessToken,
      error: null,
    };
  }

  const existingSession = await supabaseClient.auth.getSession();
  if (existingSession.error) {
    return { accessToken: null, error: existingSession.error.message };
  }

  if (existingSession.data.session?.access_token) {
    return { accessToken: existingSession.data.session.access_token, error: null };
  }

  return {
    accessToken: null,
    error: "Google sign-in completed, but no EduFX session was created. Please try again.",
  };
}
