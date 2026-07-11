"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PageState } from "@/components/ui/page-state";
import {
  getOAuthErrorFallbackMessage,
  isRecoverableOAuthError,
} from "@/features/auth/auth-redirect";
import { useAuth } from "@/features/auth/use-auth";
import {
  normalizeErrorMessage,
  resolveCallbackAccessToken,
  resolveExistingSessionAccessToken,
} from "@/features/auth/auth-callback-session";
import { supabase } from "@/lib/supabase";

// A stale/mismatched PKCE code verifier (e.g. the sign-in flow was retried in
// another tab) is transient — a fresh signInWithOAuth() call almost always
// succeeds immediately. Auto-retry once per browser session instead of
// making the user notice the error and click through "Back to login" again;
// if the retry also fails, something more persistent is wrong and we show
// the error card rather than looping forever.
const AUTO_RETRY_FLAG_KEY = "edufx.mvc.oauth-callback-auto-retried";

export function AuthCallbackScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { student, authenticateWithAccessToken, authError: authContextError, signInWithGoogle } =
    useAuth();
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const oauthError =
      normalizeErrorMessage(searchParams.get("error_description")) ??
      normalizeErrorMessage(searchParams.get("error"));
    const oauthErrorCode = searchParams.get("error_code");

    if (!supabase) {
      setError(
        oauthError
          ? getOAuthErrorFallbackMessage(oauthErrorCode, oauthError)
          : "Supabase is not configured for Google sign-in.",
      );
      return;
    }

    const supabaseClient = supabase;
    let cancelled = false;
    const slowId = window.setTimeout(() => {
      if (!cancelled) {
        setSlow(true);
      }
    }, 8000);

    function markAuthenticated() {
      window.sessionStorage.removeItem(AUTO_RETRY_FLAG_KEY);
    }

    // Returns true if it kicked off a fresh sign-in redirect (caller should
    // stop and not show an error card), false if the one-shot retry budget
    // for this browser session is already spent.
    function autoRetryOnce(): boolean {
      if (window.sessionStorage.getItem(AUTO_RETRY_FLAG_KEY)) {
        return false;
      }
      window.sessionStorage.setItem(AUTO_RETRY_FLAG_KEY, "1");
      void signInWithGoogle();
      return true;
    }

    async function finalizeCallback() {
      if (student) {
        clearTimeout(slowId);
        markAuthenticated();
        router.replace(student.diagnostic_completed ? "/dashboard" : "/diagnostic/self-assessment");
        return;
      }

      if (oauthError) {
        if (!isRecoverableOAuthError(oauthErrorCode, oauthError)) {
          setError(oauthError);
          return;
        }

        const recoveredSession = await resolveExistingSessionAccessToken(supabaseClient);
        if (cancelled) {
          return;
        }

        if (!recoveredSession.accessToken) {
          if (autoRetryOnce()) {
            return;
          }
          setError(getOAuthErrorFallbackMessage(oauthErrorCode, recoveredSession.error ?? oauthError));
          return;
        }

        try {
          const profile = await authenticateWithAccessToken(recoveredSession.accessToken);
          if (cancelled) {
            return;
          }
          clearTimeout(slowId);
          markAuthenticated();
          router.replace(profile.diagnostic_completed ? "/dashboard" : "/diagnostic/self-assessment");
          return;
        } catch (loginError) {
          if (cancelled) {
            return;
          }
          const message =
            loginError instanceof Error
              ? loginError.message
              : authContextError ?? getOAuthErrorFallbackMessage(oauthErrorCode, oauthError);
          setError(message);
          return;
        }
      }

      const resolution = await resolveCallbackAccessToken(
        new URLSearchParams(searchParams.toString()),
        window.location.hash,
        supabaseClient,
        () => {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
      );
      if (cancelled) {
        return;
      }

      if (resolution.error || !resolution.accessToken) {
        // A stale/mismatched PKCE verifier is the recoverable case here — a
        // fresh signInWithOAuth() call gets a new verifier and almost always
        // succeeds, so retry automatically before bothering the user with it.
        if (resolution.error && isRecoverableOAuthError(null, resolution.error) && autoRetryOnce()) {
          return;
        }
        setError(
          resolution.error
            ? getOAuthErrorFallbackMessage(null, resolution.error)
            : "Google sign-in completed, but no EduFX session was created. Please try again.",
        );
        return;
      }

      try {
        const profile = await authenticateWithAccessToken(resolution.accessToken);
        if (cancelled) {
          return;
        }
        clearTimeout(slowId);
        markAuthenticated();
        router.replace(profile.diagnostic_completed ? "/dashboard" : "/diagnostic/self-assessment");
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
      clearTimeout(slowId);
    };
  }, [student, authenticateWithAccessToken, authContextError, router, searchParams]);

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
      layout="auth"
      title="Signing you in"
      message={
        slow
          ? "Finalizing your secure EduFX session. This can take a little longer if the study server is waking up."
          : "Completing your Google sign-in and loading your EduFX study profile."
      }
      eyebrow="Secure sign-in"
    />
  );
}
