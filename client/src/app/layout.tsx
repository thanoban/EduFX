import "./globals.css";

import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import { AuthProvider } from "@/features/auth/auth-provider";

export const metadata: Metadata = {
  title: "EduFX",
  description: "Adaptive A-Level chemistry learning platform."
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
