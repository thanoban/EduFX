"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
          <span className="pill">MVC rebuild</span>
          <h1>Adaptive chemistry learning that feels intentional, measurable, and personal.</h1>
          <p>
            EduFX guides students from diagnostic assessment to daily study plans, webcam-ready quiz
            sessions, and progress loops shaped by performance and focus signals.
          </p>
          <div className="grid-2">
            <div className="section-card">
              <h3>Preserved contract</h3>
              <p className="muted">FastAPI routes and response envelope stay aligned with the brief.</p>
            </div>
            <div className="section-card">
              <h3>CV-ready structure</h3>
              <p className="muted">Repositories, services, controllers, routes, shared contracts, and feature UI.</p>
            </div>
          </div>
        </div>
      }
    >
      <div className="stack">
        <span className="pill">Welcome back</span>
        <h2>Sign in to EduFX</h2>
        <p className="muted">
          Use Google auth when Supabase keys are configured, or continue with the seeded demo profile for
          a full local walkthrough.
        </p>
        <Button onClick={handleGoogle} disabled={busy || loading}>
          Continue with Google
        </Button>
        <Button variant="secondary" onClick={handleDemo} disabled={busy || loading}>
          Use demo student
        </Button>
      </div>
    </AuthShell>
  );
}
