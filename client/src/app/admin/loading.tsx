import { WorkspaceRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <WorkspaceRouteLoading
      title="Loading admin portal"
      message="EduFX is gathering student performance data."
      eyebrow="Admin"
    />
  );
}
