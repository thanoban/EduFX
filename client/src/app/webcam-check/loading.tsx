import { WorkspaceRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <WorkspaceRouteLoading
      title="Preparing camera check"
      message="Loading webcam readiness, privacy guidance, and focus tracking setup."
      eyebrow="Camera permissions"
    />
  );
}
