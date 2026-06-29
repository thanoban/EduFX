"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";

import { authApi } from "@/lib/api";
import { IDLE_SESSION_TIMEOUT_MS, STORAGE_KEYS } from "@/lib/constants";
import { readStorage, removeStorage, writeStorage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import type { StudentProfile } from "@/types/contracts";

type AuthContextValue = {
  student: StudentProfile | null;
  token: string | null;
  loading: boolean;
  authError: string | null;
  authenticateWithAccessToken: (accessToken: string) => Promise<StudentProfile>;
  signInDemo: (profile?: { name?: string; email?: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<StudentProfile>;
  signUpWithEmail: (
    email: string,
    password: string
  ) => Promise<{ profile: StudentProfile | null; needsConfirmation: boolean }>;
  signOut: () => void;
  refreshStatus: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const AUTO_BOOTSTRAP_DEMO = process.env.NEXT_PUBLIC_SKIP_LOGIN !== "false";
const DEFAULT_DEMO_PROFILE = {
  name: "Ali Hassan",
  email: "ali.hassan@edufx.demo"
};

async function getSessionWithTimeout(timeoutMs: number) {
  if (!supabase) {
    return null;
  }
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<null>((_, reject) => {
      window.setTimeout(() => reject(new Error("Supabase session bootstrap timed out")), timeoutMs);
    })
  ]);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const lastHandledTokenRef = useRef<string | null>(null);
  const oauthRedirectInFlightRef = useRef(false);

  function clearSessionState() {
    lastHandledTokenRef.current = null;
    oauthRedirectInFlightRef.current = false;
    setAuthError(null);
    setStudent(null);
    setToken(null);
    removeStorage(STORAGE_KEYS.student);
    removeStorage(STORAGE_KEYS.token);
    removeStorage(STORAGE_KEYS.lastDiagnostic);
    removeStorage(STORAGE_KEYS.lastSession);
    removeStorage(STORAGE_KEYS.lastQuizResult);
  }

  function redirectToLogin(reason?: "expired") {
    const target = reason === "expired" ? "/login?session=expired" : "/login";
    window.location.replace(target);
  }

  function finishSignOut(reason?: "expired") {
    clearSessionState();
    void supabase?.auth.signOut();
    redirectToLogin(reason);
  }

  async function bootstrapDemoStudent(profile?: { name?: string; email?: string }) {
    const name = profile?.name ?? DEFAULT_DEMO_PROFILE.name;
    const email = profile?.email ?? DEFAULT_DEMO_PROFILE.email;
    const demoToken = `demo:${name}:${email}`;
    const authProfile = await authApi.login(demoToken);
    setAuthError(null);
    setStudent(authProfile);
    setToken(demoToken);
    writeStorage(STORAGE_KEYS.student, authProfile);
    writeStorage(STORAGE_KEYS.token, demoToken);
  }

  async function authenticateWithAccessToken(accessToken: string) {
    const cachedStudent = readStorage<StudentProfile | null>(STORAGE_KEYS.student, null);
    const cachedToken = readStorage<string | null>(STORAGE_KEYS.token, null);

    if (lastHandledTokenRef.current === accessToken && cachedStudent && cachedToken === accessToken) {
      setAuthError(null);
      setStudent(cachedStudent);
      setToken(accessToken);
      return cachedStudent;
    }

    lastHandledTokenRef.current = accessToken;
    setAuthError(null);

    try {
      const profile = await authApi.login(accessToken);
      setStudent(profile);
      setToken(accessToken);
      writeStorage(STORAGE_KEYS.student, profile);
      writeStorage(STORAGE_KEYS.token, accessToken);
      return profile;
    } catch (error) {
      lastHandledTokenRef.current = null;
      const message = error instanceof Error ? error.message : "Auth login failed";
      setAuthError(message);
      throw error;
    }
  }

  useEffect(() => {
    const storedStudent = readStorage<StudentProfile | null>(STORAGE_KEYS.student, null);
    const storedToken = readStorage<string | null>(STORAGE_KEYS.token, null);
    if (storedStudent && storedToken) {
      setAuthError(null);
      setStudent(storedStudent);
      setToken(storedToken);
      setLoading(false);
      return;
    }

    if (AUTO_BOOTSTRAP_DEMO) {
      void bootstrapDemoStudent().finally(() => setLoading(false));
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    async function handleSession(accessToken: string) {
      if (lastHandledTokenRef.current === accessToken) {
        setLoading(false);
        return;
      }

      try {
        await authenticateWithAccessToken(accessToken);
      } catch (error) {
        console.error("Auth login failed", error);
      } finally {
        setLoading(false);
      }
    }

    // onAuthStateChange fires on OAuth redirect (SIGNED_IN) and session restore
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.access_token) {
          void handleSession(session.access_token);
        } else if (event === "SIGNED_OUT") {
          clearSessionState();
          setLoading(false);
        }
      }
    );

    // Also check for a session that already exists (e.g. page reload)
    getSessionWithTimeout(4000)
      .then((result) => {
        if (result?.data.session?.access_token) {
          void handleSession(result.data.session.access_token);
          return;
        }

        if (!result?.data.session) {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!student) {
      return;
    }

    let timeoutId = 0;
    let expired = false;

    const resetIdleTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        if (expired) {
          return;
        }
        expired = true;
        finishSignOut("expired");
      }, IDLE_SESSION_TIMEOUT_MS);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resetIdleTimer();
      }
    };

    resetIdleTimer();
    window.addEventListener("pointerdown", resetIdleTimer);
    window.addEventListener("keydown", resetIdleTimer);
    window.addEventListener("focus", resetIdleTimer);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("pointerdown", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
      window.removeEventListener("focus", resetIdleTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [student]);

  async function signInDemo(profile?: { name?: string; email?: string }) {
    await bootstrapDemoStudent(profile);
  }

  async function signInWithGoogle() {
    if (!supabase) {
      await signInDemo();
      return;
    }
    if (oauthRedirectInFlightRef.current) {
      return;
    }
    oauthRedirectInFlightRef.current = true;
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      });
    } catch (error) {
      oauthRedirectInFlightRef.current = false;
      throw error;
    }
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) {
      setAuthError("Email sign-in is not configured.");
      throw new Error("Email sign-in is not configured.");
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      throw new Error(error.message);
    }
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      const message = "Sign-in succeeded but no session was returned. Please try again.";
      setAuthError(message);
      throw new Error(message);
    }
    return authenticateWithAccessToken(accessToken);
  }

  async function signUpWithEmail(email: string, password: string) {
    if (!supabase) {
      setAuthError("Email sign-up is not configured.");
      throw new Error("Email sign-up is not configured.");
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
      throw new Error(error.message);
    }
    // When email confirmation is enabled, signUp returns a user but no session
    // until the user confirms via the emailed link.
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return { profile: null, needsConfirmation: true };
    }
    const profile = await authenticateWithAccessToken(accessToken);
    return { profile, needsConfirmation: false };
  }

  async function refreshStatus() {
    if (!student) {
      return;
    }
    const status = await authApi.check(student.student_id);
    const nextStudent = { ...student, diagnostic_completed: status.diagnostic_completed };
    setStudent(nextStudent);
    writeStorage(STORAGE_KEYS.student, nextStudent);
  }

  function signOut() {
    finishSignOut();
  }

  const value = useMemo(
    () => ({
      student,
      token,
      loading,
      authError,
      authenticateWithAccessToken,
      signInDemo,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshStatus
    }),
    [student, token, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("AuthProvider is missing");
  }
  return context;
}
