import { AuthRouteLoading } from "@/components/ui/route-loading";

export default function Loading() {
  return (
    <AuthRouteLoading
      title="Signing you in"
      message="Completing your Google sign-in and restoring your EduFX study session."
      eyebrow="Secure sign-in"
    />
  );
}
