import { WorkspaceRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <WorkspaceRouteLoading
      title="Loading student detail"
      message="EduFX is assembling this student's progress and history."
      eyebrow="Admin"
    />
  );
}
