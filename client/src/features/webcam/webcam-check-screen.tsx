"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eye, Gauge, ShieldCheck, Video, VideoOff } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";

export function WebcamCheckScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const subtopic = params.get("subtopic") ?? "1";
  const { student } = useAuthGuard();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const readinessChecks = [
    { label: "Single learner in frame", ok: cameraReady && enabled },
    { label: "Permission granted", ok: cameraReady && enabled },
    { label: "Privacy-safe local analysis", ok: true },
    { label: "Tracking optional", ok: true }
  ];

  const releasePreview = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function setupCamera() {
      if (!enabled || !navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => undefined);
        setCameraReady(true);
      } catch {
        setCameraReady(false);
      }
    }

    if (enabled) {
      void setupCamera();
    } else {
      releasePreview();
    }

    // Release the preview camera when leaving the page or toggling off, so the
    // quiz screen can acquire its own stream without a device conflict.
    return () => {
      cancelled = true;
      releasePreview();
    };
  }, [enabled]);

  return (
    <AppShell
      title="Before you begin"
      subtitle={`Prepare the session environment for ${student?.name ?? "your"} quiz run.`}
      action={
        <Button
          icon={<Video size={17} />}
          disabled={enabled && !cameraReady}
          onClick={() => router.push(`/quiz/${subtopic}?webcam=${enabled ? "1" : "0"}`)}
        >
          Start quiz now
        </Button>
      }
    >
      <section className="hero-strip">
        <div className="hero-strip__copy">
          <span className="eyebrow"><ShieldCheck size={14} /> Session check</span>
          <h3>Choose whether this quiz should include focus tracking.</h3>
          <p className="muted">
            The webcam preview is optional. EduFX keeps the analysis on-device and stores only the
            summary percentages used to reflect on study quality later.
          </p>
        </div>
        <div className="hero-strip__metrics">
          <div className="metric-box">
            <strong>{enabled ? (cameraReady ? "Ready" : "Waiting") : "Skipped"}</strong>
            <span>camera status</span>
          </div>
          <div className="metric-box">
            <strong>Local</strong>
            <span>video never uploads</span>
          </div>
          <div className="metric-box">
            <strong>Optional</strong>
            <span>quiz works without tracking</span>
          </div>
        </div>
      </section>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <StatCard
          icon={<Video size={18} />}
          label="Tracking mode"
          value={enabled ? "On" : "Off"}
          hint="Can be changed before starting the quiz"
        />
        <StatCard
          icon={<Gauge size={18} />}
          label="Readiness"
          value={cameraReady ? "Ready" : enabled ? "Checking" : "Skipped"}
          hint="Preview must be ready only when tracking is enabled"
        />
        <StatCard
          icon={<ShieldCheck size={18} />}
          label="Privacy"
          value="Local"
          hint="Only derived focus signals are stored"
        />
      </div>

      <div className="grid-2">
        <SectionCard title="Camera preview" eyebrow="Client-side only">
          <div className="camera-preview">
            {enabled ? <video ref={videoRef} muted playsInline /> : <div className="stack" style={{ textAlign: "center" }}><VideoOff size={34} />Webcam disabled</div>}
          </div>
          <div className="cluster">
            <StatusPill label={cameraReady ? "Camera ready" : "No live feed"} tone={cameraReady ? "success" : "warning"} />
            <StatusPill label={enabled ? "Tracking enabled" : "Tracking skipped"} />
          </div>
          <div className="checklist">
            {readinessChecks.map((item) => (
              <div key={item.label} className="checklist-row">
                <span className={`check-indicator ${item.ok ? "ok" : ""}`.trim()} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="What will be tracked" eyebrow="On-device AI tracker">
          <div className="stack">
            <div className="list-item">Eye openness and drowsiness signals</div>
            <div className="list-item">Looking away and presence checks</div>
            <div className="list-item">Phone, talking, and multi-person indicators</div>
            <div className="callout">
              Video stays local. EduFX stores only derived focus flags and session summary percentages.
            </div>
            {enabled && !cameraReady ? (
              <div className="callout">
                Camera tracking is enabled, but the preview is not ready yet. Wait for the feed or
                switch to &quot;Skip tracking&quot; to continue immediately.
              </div>
            ) : null}
            <div className="cluster decision-actions">
              <Button icon={<VideoOff size={16} />} variant={enabled ? "secondary" : "primary"} onClick={() => setEnabled(false)}>
                Skip tracking
              </Button>
              <Button icon={<Eye size={16} />} variant={enabled ? "primary" : "secondary"} onClick={() => setEnabled(true)}>
                Enable tracking
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
