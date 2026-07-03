import { WorkspaceRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <WorkspaceRouteLoading
      title="Loading behaviour history"
      message="Collecting recent focus summaries, session signals, and study context."
      eyebrow="Behaviour logs"
    />
  );
}
