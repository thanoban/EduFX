"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Flame,
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
  const adaptivePlanReady = Boolean(student?.diagnostic_completed);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Fx</div>
          <div className="brand-copy">
            <h1>EduFX</h1>
            <small>Chemistry · A-Level</small>
          </div>
        </div>

        <div className="sidebar-section-label">Workspace</div>
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
                <Icon size={17} strokeWidth={2.2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        <div className="sidebar-insight">
          <div className="cluster" style={{ justifyContent: "space-between" }}>
            <Flame size={16} />
            <span className="sidebar-insight__score">12-day streak</span>
          </div>
          <div className="progress-bar">
            <span style={{ width: "80%" }} />
          </div>
          <span>3 sessions to your weekly goal</span>
        </div>

        <div className="sidebar-user stack">
          <div className="cluster" style={{ alignItems: "center", flexWrap: "nowrap" }}>
            <div className="avatar" aria-hidden="true">
              {(student?.name ?? "Student").slice(0, 2).toUpperCase()}
            </div>
            <div className="sidebar-user__meta">
              <strong>{student?.name ?? "Student"}</strong>
              <div className="muted">{student?.email ?? "Not signed in"}</div>
            </div>
          </div>
          <div className="sidebar-user__actions">
            <Button variant="ghost" icon={<LogOut size={15} />} onClick={signOut}>
              Log out
            </Button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="workspace-topbar">
          <div className="stack" style={{ gap: 4 }}>
            <span className="eyebrow">
              <ShieldCheck size={13} /> Signed-in workspace
            </span>
            <div className="workspace-topbar__identity">
              <strong>{student?.name ?? "EduFX student"}</strong>
              <span>{student?.email ?? "Adaptive study session ready"}</span>
            </div>
          </div>
          <div className="workspace-topbar__actions">
            <span className={`pill ${adaptivePlanReady ? "success" : "warning"}`.trim()}>
              {adaptivePlanReady ? "Adaptive plan active" : "Diagnostic required"}
            </span>
          </div>
        </header>
        <div className="page-panel">
          <header className="page-header">
            <div className="stack">
              <span className="eyebrow"><ShieldCheck size={13} /> EduFX workspace</span>
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
