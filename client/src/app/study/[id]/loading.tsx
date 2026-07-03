import { WorkspaceRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <WorkspaceRouteLoading
      title="Opening study notes"
      message="Selecting level-aware notes, checkpoints, and guided explanations."
      eyebrow="Study"
    />
  );
}
