import { Suspense } from "react";

import { PageState } from "@/components/ui/page-state";
import { HomeRedirectScreen } from "@/features/auth/home-redirect-screen";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <PageState
          title="Opening EduFX"
          message="Routing you to sign in and restoring any pending authentication session."
        />
      }
    >
      <HomeRedirectScreen />
    </Suspense>
  );
}
