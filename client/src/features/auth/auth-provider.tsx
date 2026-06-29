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
import { STORAGE_KEYS } from "@/lib/constants";
import { readStorage, removeStorage, writeStorage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import type { StudentProfile } from "@/types/contracts";

type AuthContextValue = {
  student: StudentProfile | null;
  token: string | null;
  loading: boolean;
  signInDemo: (profile?: { name?: string; email?: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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
  const lastHandledTokenRef = useRef<string | null>(null);

  async function bootstrapDemoStudent(profile?: { name?: string; email?: string }) {
    const name = profile?.name ?? DEFAULT_DEMO_PROFILE.name;
    const email = profile?.email ?? DEFAULT_DEMO_PROFILE.email;
    const demoToken = `demo:${name}:${email}`;
    const authProfile = await authApi.login(demoToken);
    setStudent(authProfile);
    setToken(demoToken);
    writeStorage(STORAGE_KEYS.student, authProfile);
    writeStorage(STORAGE_KEYS.token, demoToken);
  }

  useEffect(() => {
    const storedStudent = readStorage<StudentProfile | null>(STORAGE_KEYS.student, null);
    const storedToken = readStorage<string | null>(STORAGE_KEYS.token, null);
    if (storedStudent && storedToken) {
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

      lastHandledTokenRef.current = accessToken;

      try {
        const profile = await authApi.login(accessToken);
        setStudent(profile);
        setToken(accessToken);
        writeStorage(STORAGE_KEYS.student, profile);
        writeStorage(STORAGE_KEYS.token, accessToken);
      } catch (error) {
        lastHandledTokenRef.current = null;
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
          lastHandledTokenRef.current = null;
          setStudent(null);
          setToken(null);
          removeStorage(STORAGE_KEYS.student);
          removeStorage(STORAGE_KEYS.token);
          removeStorage(STORAGE_KEYS.lastDiagnostic);
          removeStorage(STORAGE_KEYS.lastSession);
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

  async function signInDemo(profile?: { name?: string; email?: string }) {
    await bootstrapDemoStudent(profile);
  }

  async function signInWithGoogle() {
    if (!supabase) {
      await signInDemo();
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
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
    lastHandledTokenRef.current = null;
    setStudent(null);
    setToken(null);
    removeStorage(STORAGE_KEYS.student);
    removeStorage(STORAGE_KEYS.token);
    removeStorage(STORAGE_KEYS.lastDiagnostic);
    removeStorage(STORAGE_KEYS.lastSession);
    void supabase?.auth.signOut();
    window.location.href = "/login";
  }

  const value = useMemo(
    () => ({ student, token, loading, signInDemo, signInWithGoogle, signOut, refreshStatus }),
    [student, token, loading]
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
