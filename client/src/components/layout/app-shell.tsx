"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Flame,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/teacher", label: "AI Teacher", icon: GraduationCap },
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
  const items = student?.is_admin
    ? [...navItems, { href: "/admin", label: "Admin", icon: Users }]
    : navItems;
  const currentStreak = student?.current_streak ?? 0;
  const longestStreak = student?.longest_streak ?? 0;
  const streakProgress = longestStreak > 0 ? Math.round((currentStreak / longestStreak) * 100) : currentStreak > 0 ? 100 : 0;

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
          {items.map((item) => {
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

        <div className="sidebar-spacer" />

        <div className="sidebar-insight">
          <div className="cluster" style={{ justifyContent: "space-between" }}>
            <Flame size={16} />
            <span className="sidebar-insight__score">
              {currentStreak > 0 ? `${currentStreak}-day streak` : "No active streak"}
            </span>
          </div>
          <div className="progress-bar">
            <span style={{ width: `${streakProgress}%` }} />
          </div>
          <span>
            {longestStreak > currentStreak
              ? `Best streak: ${longestStreak} days`
              : "Study today to keep it going"}
          </span>
        </div>

        <div className="sidebar-user stack">
          <div className="sidebar-user__identity cluster">
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
          <div className="stack workspace-topbar__summary">
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
            <div className="stack page-header__copy">
              <span className="eyebrow"><ShieldCheck size={13} /> EduFX workspace</span>
              <h2>{title}</h2>
              <div className="muted">{subtitle}</div>
            </div>
            {action ? <div className="page-header__actions">{action}</div> : null}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
