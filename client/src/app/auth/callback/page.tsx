import { Suspense } from "react";

import { PageState } from "@/components/ui/page-state";
import { AuthCallbackScreen } from "@/features/auth/auth-callback-screen";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <PageState
          layout="auth"
          title="Signing you in"
          message="Completing your Google sign-in and loading your EduFX study profile."
          eyebrow="Secure sign-in"
        />
      }
    >
      <AuthCallbackScreen />
    </Suspense>
  );
}
