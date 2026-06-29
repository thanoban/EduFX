"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PageState } from "@/components/ui/page-state";
import { useAuth } from "@/features/auth/use-auth";
import {
  normalizeErrorMessage,
  resolveCallbackAccessToken,
} from "@/features/auth/auth-callback-session";
import { supabase } from "@/lib/supabase";

export function AuthCallbackScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticateWithAccessToken, authError: authContextError } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError =
      normalizeErrorMessage(searchParams.get("error_description")) ??
      normalizeErrorMessage(searchParams.get("error"));

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
        setError(resolution.error ?? "Google sign-in completed, but no EduFX session was created. Please try again.");
        return;
      }

      try {
        const profile = await authenticateWithAccessToken(resolution.accessToken);
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
  }, [authenticateWithAccessToken, authContextError, router, searchParams]);

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
