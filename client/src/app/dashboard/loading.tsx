import { WorkspaceRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <WorkspaceRouteLoading
      title="Preparing your workspace"
      message="EduFX is loading your dashboard, plan, and progress."
      eyebrow="Dashboard"
    />
  );
}
