"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, FlaskConical, GraduationCap, Mail, ShieldCheck } from "lucide-react";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";

export function LoginScreen() {
  const router = useRouter();
  const {
    student,
    signInDemo,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    loading
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      router.replace(student.diagnostic_completed ? "/dashboard" : "/diagnostic");
    }
  }, [student, router]);

  async function handleDemo() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await signInDemo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setBusy(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      if (mode === "signup") {
        const result = await signUpWithEmail(email.trim(), password);
        if (result.needsConfirmation) {
          setNote("Account created. Check your inbox to confirm your email, then sign in.");
          setMode("signin");
        }
        // If no confirmation needed, the student effect above redirects.
      } else {
        await signInWithEmail(email.trim(), password);
        // The student effect above handles the redirect.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      hero={
        <div className="stack">
          <span className="pill"><FlaskConical size={15} /> A-Level chemistry</span>
          <h1>EduFX</h1>
          <p>
            Adaptive study planning, focused quiz sessions, and behaviour-aware feedback for the
            S-block chemistry unit.
          </p>
          <div className="grid-2">
            <div className="section-card">
              <h3>10 subtopics</h3>
              <p className="muted">Diagnostic levels and daily plans across Group 1 and Group 2.</p>
            </div>
            <div className="section-card">
              <h3>Focus reports</h3>
              <p className="muted">Optional webcam summaries support better study routines.</p>
            </div>
          </div>
        </div>
      }
    >
      <div className="stack">
        <span className="pill"><ShieldCheck size={15} /> Secure access</span>
        <h2>{mode === "signup" ? "Create your EduFX account" : "Sign in to EduFX"}</h2>
        <p className="muted">
          Use your email and password, continue with Google, or try the local demo student.
        </p>

        {error ? <div className="auth-error">{error}</div> : null}
        {note ? <div className="auth-note">{note}</div> : null}

        <form className="stack" onSubmit={handleEmailSubmit}>
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="field__input"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Password</span>
            <input
              className="field__input"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              placeholder="At least 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button
            type="submit"
            icon={<Mail size={17} />}
            disabled={busy || loading}
          >
            {mode === "signup" ? "Create account" : "Sign in with email"}
          </Button>
        </form>

        <p className="muted small-text">
          {mode === "signup" ? "Already have an account? " : "New to EduFX? "}
          <button
            type="button"
            className="auth-toggle"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
              setNote(null);
            }}
          >
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>

        <div className="auth-divider">or</div>

        <Button
          variant="secondary"
          icon={<GraduationCap size={17} />}
          onClick={handleGoogle}
          disabled={busy || loading}
        >
          Continue with Google
        </Button>
        <Button
          variant="ghost"
          icon={<ArrowRight size={17} />}
          onClick={handleDemo}
          disabled={busy || loading}
        >
          Use demo student
        </Button>
      </div>
    </AuthShell>
  );
}
