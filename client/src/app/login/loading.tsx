import { AuthRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <AuthRouteLoading
      title="Opening EduFX"
      message="Preparing secure sign-in and your academic workspace."
      eyebrow="Welcome back"
    />
  );
}
