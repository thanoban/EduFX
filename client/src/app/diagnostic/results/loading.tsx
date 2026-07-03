import { AuthRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <AuthRouteLoading
      title="Loading adaptive results"
      message="Scoring your diagnostic and mapping the starting level for each subtopic."
      eyebrow="Diagnostic results"
    />
  );
}
