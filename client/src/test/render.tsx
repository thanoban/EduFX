import React from "react";
import { render } from "@testing-library/react";
import { type PropsWithChildren, type ReactElement } from "react";

import { AuthContext } from "@/features/auth/auth-provider";
import type { StudentProfile } from "@/types/contracts";

const defaultStudent: StudentProfile = {
  student_id: 1,
  name: "Ali Hassan",
  email: "ali.hassan@edufx.demo",
  diagnostic_completed: true
};

export function renderWithAuth(
  ui: ReactElement,
  {
    student = defaultStudent
  }: {
    student?: StudentProfile | null;
  } = {}
) {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <AuthContext.Provider
        value={{
          student,
          token: "demo:Ali Hassan:ali.hassan@edufx.demo",
          loading: false,
          signInDemo: async () => undefined,
          signInWithGoogle: async () => undefined,
          signOut: () => undefined,
          refreshStatus: async () => undefined
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
