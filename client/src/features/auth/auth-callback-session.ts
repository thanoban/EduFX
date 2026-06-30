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

const SESSION_POLL_INTERVAL_MS = 250;
const SESSION_POLL_TIMEOUT_MS = 5000;

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

async function waitForExistingSessionAccessToken(
  supabaseClient: SupabaseClientLike,
  timeoutMs: number = SESSION_POLL_TIMEOUT_MS,
) {
  const deadline = Date.now() + timeoutMs;
  let lastError: string | null = null;

  while (Date.now() <= deadline) {
    const existingSession = await supabaseClient.auth.getSession();
    if (existingSession.error) {
      lastError = existingSession.error.message;
    }

    if (existingSession.data.session?.access_token) {
      return { accessToken: existingSession.data.session.access_token, error: null };
    }

    if (Date.now() >= deadline) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, SESSION_POLL_INTERVAL_MS));
  }

  return { accessToken: null, error: lastError };
}

export async function resolveCallbackAccessToken(
  searchParams: URLSearchParams,
  hash: string,
  supabaseClient: SupabaseClientLike,
  onHashTokensApplied?: () => void,
  options?: {
    sessionWaitTimeoutMs?: number;
  },
) {
  const callbackTokens = readCallbackTokens(searchParams, hash);
  if (callbackTokens.error) {
    return { accessToken: null, error: callbackTokens.error };
  }

  if (callbackTokens.code) {
    // With detectSessionInUrl enabled, supabase-js performs the PKCE exchange
    // automatically on the callback page. Give that automatic flow a moment to
    // populate the session before trying a manual exchange, otherwise the same
    // one-time code can be consumed twice and the redirect stalls or errors.
    const detectedSession = await waitForExistingSessionAccessToken(
      supabaseClient,
      options?.sessionWaitTimeoutMs,
    );
    if (detectedSession.accessToken) {
      return detectedSession;
    }

    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(callbackTokens.code);

    if (!error && data.session?.access_token) {
      return { accessToken: data.session.access_token, error: null };
    }

    // The client may have `detectSessionInUrl` enabled, which exchanges the
    // one-time code automatically before this manual call runs. In that case the
    // manual exchange errors ("code already used") even though sign-in actually
    // succeeded — so always check getSession before surfacing the exchange error.
    const fallbackSession = await supabaseClient.auth.getSession();
    if (fallbackSession.data.session?.access_token) {
      return { accessToken: fallbackSession.data.session.access_token, error: null };
    }

    if (error) {
      return { accessToken: null, error: error.message };
    }

    if (fallbackSession.error) {
      return { accessToken: null, error: fallbackSession.error.message };
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

export async function resolveExistingSessionAccessToken(supabaseClient: SupabaseClientLike) {
  return waitForExistingSessionAccessToken(supabaseClient);
}
