"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PageState } from "@/components/ui/page-state";
import { resolveAuthRedirectTarget } from "@/features/auth/auth-redirect";

export function HomeRedirectScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const target = resolveAuthRedirectTarget(
      new URLSearchParams(searchParams.toString()),
      window.location.hash,
    );

    router.replace(target);
  }, [router, searchParams]);

  return (
    <PageState
      title="Opening EduFX"
      message="Routing you to sign in and restoring any pending authentication session."
    />
  );
}
