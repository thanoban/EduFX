"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/use-auth";

export function useAuthGuard() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.student) {
      router.replace("/login");
    }
  }, [auth.loading, auth.student, router]);

  return auth;
}
