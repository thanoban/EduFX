"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Gauge,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/behaviour-logs", label: "Behaviour Logs", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings }
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
          <div className="brand-mark">FX</div>
          <div>
            <h1>EduFX</h1>
            <small>Adaptive Chemistry Platform</small>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${pathname === item.href ? "active" : ""}`.trim()}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={2.2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-insight">
          <div className="cluster" style={{ justifyContent: "space-between" }}>
            <Gauge size={18} />
            <span className="sidebar-insight__score">Live</span>
          </div>
          <strong>Focus-aware learning</strong>
          <span>Quiz behaviour, progress, and next-topic scheduling stay connected.</span>
        </div>
        <div className="sidebar-user stack">
          <div className="avatar" aria-hidden="true">
            {(student?.name ?? "Student").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>{student?.name ?? "Student"}</strong>
            <div className="muted">{student?.email ?? "Not signed in"}</div>
          </div>
          <Button variant="ghost" icon={<LogOut size={16} />} onClick={signOut}>
            Log out
          </Button>
        </div>
      </aside>
      <main className="main-area">
        <div className="page-panel">
          <header className="page-header">
            <div className="stack">
              <span className="eyebrow"><ShieldCheck size={14} /> EduFX workspace</span>
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
