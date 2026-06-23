import { useAuthContext } from "@/features/auth/auth-provider";

export function useAuth() {
  return useAuthContext();
}
