"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/progress", label: "Progress" },
  { href: "/behaviour-logs", label: "Behaviour Logs" },
  { href: "/settings", label: "Settings" }
];

export function AppShell({
  title,
  subtitle,
  action,
  children
}: PropsWithChildren<{ title: string; subtitle: string; action?: ReactNode }>) {
  const pathname = usePathname();
  const { student, signOut } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>EduFX</h1>
          <small>Adaptive Education Platform</small>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${pathname === item.href ? "active" : ""}`.trim()}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-user stack">
          <div>
            <strong>{student?.name ?? "Student"}</strong>
            <div className="muted">{student?.email ?? "Not signed in"}</div>
          </div>
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </aside>
      <main className="main-area">
        <div className="page-panel">
          <header className="page-header">
            <div className="stack">
              <h2>{title}</h2>
              <div className="muted">{subtitle}</div>
            </div>
            {action}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
