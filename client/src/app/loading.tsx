import { AuthRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <AuthRouteLoading
      title="Loading EduFX"
      message="Preparing your study workspace, syncing progress, and loading the next screen."
      eyebrow="Starting EduFX"
    />
  );
}
