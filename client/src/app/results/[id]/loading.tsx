import { WorkspaceRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <WorkspaceRouteLoading
      title="Loading results"
      message="Preparing quiz score, focus summary, and answer explanations."
      eyebrow="Results"
    />
  );
}
