import { AuthRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <AuthRouteLoading
      title="Building diagnostic"
      message="EduFX is preparing the 40-question placement check for your study path."
      eyebrow="Diagnostic"
    />
  );
}
