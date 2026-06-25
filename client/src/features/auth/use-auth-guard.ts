"use client";

import { useAuth } from "@/features/auth/use-auth";

export function useAuthGuard() {
  return useAuth();
}
