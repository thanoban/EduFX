import "./globals.css";

import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import { AuthProvider } from "@/features/auth/auth-provider";

export const metadata: Metadata = {
  title: "EduFX MVC",
  description: "Adaptive education platform rebuilt with MVC and layered architecture."
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
