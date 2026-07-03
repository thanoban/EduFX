import { WorkspaceRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <WorkspaceRouteLoading
      title="Preparing quiz"
      message="Building your next question set and syncing the latest topic state."
      eyebrow="Quiz"
    />
  );
}
