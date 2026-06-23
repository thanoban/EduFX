"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

  useEffect(() => {
    const storedStudent = readStorage<StudentProfile | null>(STORAGE_KEYS.student, null);
    const storedToken = readStorage<string | null>(STORAGE_KEYS.token, null);
    if (storedStudent) {
      setStudent(storedStudent);
    }
    if (storedToken) {
      setToken(storedToken);
    }

    async function syncSupabase() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const sessionResult = await getSessionWithTimeout(4000);
        if (!sessionResult) {
          return;
        }
        const { data } = sessionResult;
        const accessToken = data.session?.access_token;
        if (accessToken) {
          const profile = await authApi.login(accessToken);
          setStudent(profile);
          setToken(accessToken);
          writeStorage(STORAGE_KEYS.student, profile);
          writeStorage(STORAGE_KEYS.token, accessToken);
        }
      } catch (error) {
        console.error("Supabase session bootstrap failed", error);
      } finally {
        setLoading(false);
      }
    }

    void syncSupabase();
  }, []);

  async function signInDemo(profile?: { name?: string; email?: string }) {
    const name = profile?.name ?? "Ali Hassan";
    const email = profile?.email ?? "ali.hassan@edufx.demo";
    const demoToken = `demo:${name}:${email}`;
    const authProfile = await authApi.login(demoToken);
    setStudent(authProfile);
    setToken(demoToken);
    writeStorage(STORAGE_KEYS.student, authProfile);
    writeStorage(STORAGE_KEYS.token, demoToken);
  }

  async function signInWithGoogle() {
    if (!supabase) {
      await signInDemo();
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` }
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
