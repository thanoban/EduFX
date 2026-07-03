import "./globals.css";

import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { JetBrains_Mono, Onest } from "next/font/google";

import { AuthProvider } from "@/features/auth/auth-provider";

const onest = Onest({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "600"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "EduFX — Adaptive Chemistry Platform",
  description: "Adaptive A-Level chemistry learning platform."
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" className={`${onest.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
