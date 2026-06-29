"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PageState } from "@/components/ui/page-state";

const AUTH_QUERY_KEYS = ["code", "error", "error_description", "access_token", "refresh_token"];

export function HomeRedirectScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const nextQuery = searchParams.toString();
    const hasAuthParams = AUTH_QUERY_KEYS.some((key) => searchParams.has(key));
    const target = hasAuthParams
      ? `/auth/callback${nextQuery ? `?${nextQuery}` : ""}`
      : "/login";

    router.replace(target);
  }, [router, searchParams]);

  return (
    <PageState
      title="Opening EduFX"
      message="Routing you to sign in and restoring any pending authentication session."
    />
  );
}
