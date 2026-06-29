"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PageState } from "@/components/ui/page-state";
import { useAuth } from "@/features/auth/use-auth";
import { supabase } from "@/lib/supabase";

function normalizeErrorMessage(raw: string | null) {
  if (!raw) {
    return null;
  }

  return decodeURIComponent(raw.replace(/\+/g, " "));
}

export function AuthCallbackScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticateWithAccessToken, authError: authContextError } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const oauthError = useMemo(
    () =>
      normalizeErrorMessage(searchParams.get("error_description")) ??
      normalizeErrorMessage(searchParams.get("error")),
    [searchParams]
  );

  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (!supabase) {
      setError("Supabase is not configured for Google sign-in.");
      return;
    }

    const supabaseClient = supabase;
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setError("Google sign-in is taking too long. Please try again.");
      }
    }, 12000);

    async function finalizeCallback() {
      const code = searchParams.get("code");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError =
        normalizeErrorMessage(hashParams.get("error_description")) ??
        normalizeErrorMessage(hashParams.get("error"));

      if (hashError) {
        setError(hashError);
        return;
      }

      const { data: existingSession, error: existingSessionError } = await supabaseClient.auth.getSession();
      if (cancelled) {
        return;
      }
      if (existingSessionError) {
        setError(existingSessionError.message);
        return;
      }

      if (!existingSession.session) {
        if (code) {
          const { error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
          if (cancelled) {
            return;
          }
          if (exchangeError) {
            setError(exchangeError.message);
            return;
          }
        } else {
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error: setSessionError } = await supabaseClient.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            if (cancelled) {
              return;
            }
            if (setSessionError) {
              setError(setSessionError.message);
              return;
            }

            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          }
        }
      }

      const { data: finalSession, error: finalSessionError } = await supabaseClient.auth.getSession();
      if (cancelled) {
        return;
      }
      if (finalSessionError) {
        setError(finalSessionError.message);
        return;
      }
      if (!finalSession.session) {
        setError("Google sign-in completed, but no EduFX session was created. Please try again.");
        return;
      }

      try {
        const profile = await authenticateWithAccessToken(finalSession.session.access_token);
        if (cancelled) {
          return;
        }
        clearTimeout(timeoutId);
        router.replace(profile.diagnostic_completed ? "/dashboard" : "/diagnostic");
      } catch (loginError) {
        if (cancelled) {
          return;
        }
        const message =
          loginError instanceof Error ? loginError.message : authContextError ?? "EduFX login failed.";
        setError(message);
      }
    }

    void finalizeCallback();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [oauthError, authenticateWithAccessToken, authContextError, router, searchParams]);

  if (error) {
    return (
      <PageState
        tone="error"
        title="Sign-in could not be completed"
        message={error}
        actionLabel="Back to login"
        onAction={() => router.replace("/login")}
      />
    );
  }

  return (
    <PageState
      title="Signing you in"
      message="Completing your Google sign-in and loading your EduFX study profile."
    />
  );
}
