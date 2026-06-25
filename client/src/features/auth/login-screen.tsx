"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, FlaskConical, GraduationCap, ShieldCheck } from "lucide-react";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";

export function LoginScreen() {
  const router = useRouter();
  const { student, signInDemo, signInWithGoogle, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (student) {
      router.replace(student.diagnostic_completed ? "/dashboard" : "/diagnostic");
    }
  }, [student, router]);

  async function handleDemo() {
    setBusy(true);
    try {
      await signInDemo();
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      await signInWithGoogle();
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
        <h2>Sign in to EduFX</h2>
        <p className="muted">
          Continue with your Google account, or use the local student profile for a fast walkthrough.
        </p>
        <Button icon={<GraduationCap size={17} />} onClick={handleGoogle} disabled={busy || loading}>
          Continue with Google
        </Button>
        <Button variant="secondary" icon={<ArrowRight size={17} />} onClick={handleDemo} disabled={busy || loading}>
          Use demo student
        </Button>
      </div>
    </AuthShell>
  );
}
