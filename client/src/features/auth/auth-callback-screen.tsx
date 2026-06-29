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
  const { student, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const authError = useMemo(
    () =>
      normalizeErrorMessage(searchParams.get("error_description")) ??
      normalizeErrorMessage(searchParams.get("error")),
    [searchParams]
  );

  useEffect(() => {
    if (authError) {
      setError(authError);
      return;
    }

    if (!supabase) {
      setError("Supabase is not configured for Google sign-in.");
      return;
    }

    const supabaseClient = supabase;
    let cancelled = false;

    async function finalizeCallback() {
      const code = searchParams.get("code");

      const { data: existingSession, error: existingSessionError } = await supabaseClient.auth.getSession();
      if (cancelled) {
        return;
      }
      if (existingSessionError) {
        setError(existingSessionError.message);
        return;
      }

      if (!existingSession.session && code) {
        const { error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
        if (cancelled) {
          return;
        }
        if (exchangeError) {
          setError(exchangeError.message);
          return;
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
      }
    }

    void finalizeCallback();

    return () => {
      cancelled = true;
    };
  }, [authError, searchParams]);

  useEffect(() => {
    if (!loading && student) {
      router.replace(student.diagnostic_completed ? "/dashboard" : "/diagnostic");
    }
  }, [loading, router, student]);

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
