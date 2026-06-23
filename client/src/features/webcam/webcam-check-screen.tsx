"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useAuthGuard } from "@/features/auth/use-auth-guard";

export function WebcamCheckScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const subtopic = params.get("subtopic") ?? "1";
  const { student } = useAuthGuard();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    async function setupCamera() {
      if (!enabled || !navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => undefined);
        setCameraReady(true);
      } catch {
        setCameraReady(false);
      }
    }
    void setupCamera();
  }, [enabled]);

  return (
    <AppShell
      title="Before you begin"
      subtitle={`Prepare the session environment for ${student?.name ?? "your"} quiz run.`}
      action={
        <Button onClick={() => router.push(`/quiz/${subtopic}?webcam=${enabled ? "1" : "0"}`)}>
          Start quiz now
        </Button>
      }
    >
      <div className="grid-2">
        <SectionCard title="Camera preview" eyebrow="Client-side only">
          <div className="camera-preview">
            {enabled ? <video ref={videoRef} muted playsInline style={{ maxWidth: "100%", borderRadius: 18 }} /> : <div>Webcam disabled</div>}
          </div>
          <div className="cluster">
            <StatusPill label={cameraReady ? "Camera ready" : "No live feed"} tone={cameraReady ? "success" : "warning"} />
            <StatusPill label={enabled ? "Tracking enabled" : "Tracking skipped"} />
          </div>
        </SectionCard>
        <SectionCard title="What will be tracked" eyebrow="Demo tracker">
          <div className="stack">
            <div className="list-item">Eye openness and drowsiness signals</div>
            <div className="list-item">Looking away and presence checks</div>
            <div className="list-item">Phone, talking, and multi-person indicators</div>
            <div className="cluster">
              <Button variant={enabled ? "secondary" : "primary"} onClick={() => setEnabled(false)}>
                Skip tracking
              </Button>
              <Button variant={enabled ? "primary" : "secondary"} onClick={() => setEnabled(true)}>
                Enable tracking
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
