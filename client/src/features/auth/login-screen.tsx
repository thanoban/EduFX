"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, GraduationCap, Lock, Mail } from "lucide-react";

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("session") === "expired") {
      setNote("Your EduFX session expired after 30 minutes of inactivity. Please sign in again.");
    }
  }, []);

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
    <main className="login-page-v2">
      <section className="login-story-panel" aria-label="EduFX learning workspace">
        <div className="login-brand">
          <div className="login-brand__mark" aria-hidden="true" />
          <strong>EduFX</strong>
        </div>

        <div className="login-story-copy">
          <span className="pill">
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#34d399" }} />
            Adaptive · S-block unit
          </span>
          <h1>Master A-Level chemistry, one focused session at a time.</h1>
          <p>
            Diagnostic-driven study plans, distraction-free quizzes, and behaviour-aware feedback
            across Group 1 and Group 2.
          </p>
          <div className="login-story-stats">
            <div className="login-story-stats__item">
              <strong>10</strong>
              <span>subtopics</span>
            </div>
            <div className="login-story-stats__divider" />
            <div className="login-story-stats__item">
              <strong>3</strong>
              <span>mastery levels</span>
            </div>
            <div className="login-story-stats__divider" />
            <div className="login-story-stats__item">
              <strong>92</strong>
              <span>focus score</span>
            </div>
          </div>
        </div>

        <div className="login-story-trust">
          <div className="login-story-trust__avatars">
            <span style={{ background: "#6d5efc" }} />
            <span style={{ background: "#14b8a6" }} />
            <span style={{ background: "#f59e0b" }} />
          </div>
          Trusted by 2,400+ chemistry students
        </div>
      </section>

      <section className="login-form-stage" aria-label="Sign in to EduFX">
        <div className="login-card">
          <div className="login-card__header">
            <span className="mono-label">Welcome back</span>
            <h2>{mode === "signup" ? "Create account" : "Sign in to EduFX"}</h2>
            <p>
              {mode === "signup"
                ? "Enter your details to create your workspace."
                : "Continue your S-block study plan."}
            </p>
          </div>

          {error ? <div className="auth-error">{error}</div> : null}
          {note ? <div className="auth-note">{note}</div> : null}

          <form className="login-form" onSubmit={handleEmailSubmit}>
            <label className="field">
              <span className="field__label">Email address</span>
              <span className="login-input-wrap">
                <Mail size={18} />
                <input
                  className="field__input login-input"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="scholar@edufx.app"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </span>
            </label>
            <label className="field">
              <span className="login-password-row">
                <span className="field__label">Password</span>
                {mode === "signin" ? (
                  <button
                    type="button"
                    className="auth-toggle"
                    onClick={() => {
                      setError(null);
                      setNote("Password reset is handled through your institution account admin.");
                    }}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </span>
              <span className="login-input-wrap">
                <Lock size={18} />
                <input
                  className="field__input login-input"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Eye size={16} style={{ left: "auto", right: 14 }} />
              </span>
            </label>
            <Button type="submit" className="login-primary-button" disabled={busy || loading}>
              {mode === "signup" ? "Create workspace" : "Sign in"}
              <ArrowRight size={17} />
            </Button>
          </form>

          <div className="auth-divider">OR</div>

          <Button
            variant="secondary"
            className="login-google-button"
            icon={<span className="google-mark" aria-hidden="true"><GraduationCap size={16} /></span>}
            onClick={handleGoogle}
            disabled={busy || loading}
          >
            Google
          </Button>

          <Button
            variant="ghost"
            className="login-demo-button"
            icon={<ArrowRight size={17} />}
            onClick={handleDemo}
            disabled={busy || loading}
          >
            Use demo student
          </Button>

          <p className="login-switch-copy">
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
        </div>
      </section>
    </main>
  );
}
