import { WorkspaceRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <WorkspaceRouteLoading
      title="Loading learning map"
      message="EduFX is assembling your topic progress and recent study history."
      eyebrow="Progress"
    />
  );
}
