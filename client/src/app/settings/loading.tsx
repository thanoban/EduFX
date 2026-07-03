import { WorkspaceRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <WorkspaceRouteLoading
      title="Opening settings"
      message="Preparing your session controls and account preferences."
      eyebrow="Settings"
    />
  );
}
