import "./globals.css";

import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { Inter } from "next/font/google";

import { AuthProvider } from "@/features/auth/auth-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "EduFX — Adaptive Chemistry Platform",
  description: "Adaptive A-Level chemistry learning platform."
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
