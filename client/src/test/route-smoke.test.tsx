import React from "react";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BehaviourLogsScreen } from "@/features/behaviour/behaviour-logs-screen";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
import { DiagnosticResultsScreen } from "@/features/diagnostic/diagnostic-results-screen";
import { LoginScreen } from "@/features/auth/login-screen";
import { ProgressScreen } from "@/features/progress/progress-screen";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { WebcamCheckScreen } from "@/features/webcam/webcam-check-screen";
import { renderWithAuth } from "@/test/render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams("subtopic=1")
}));

describe("frontend route smoke coverage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "navigator",
      {
        mediaDevices: {
          getUserMedia: vi.fn().mockRejectedValue(new Error("camera unavailable"))
        }
      }
    );
  });

  it("renders the login screen", () => {
    renderWithAuth(<LoginScreen />, { student: null });
    expect(screen.getByText("Sign in to EduFX")).toBeInTheDocument();
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
  });

  it("renders diagnostic results", () => {
    renderWithAuth(
      <DiagnosticResultsScreen
        results={[
          {
            subtopic_id: 1,
            subtopic_title: "Group Trends",
            score_percent: 75,
            assigned_level: "advanced"
          }
        ]}
      />
    );
    expect(screen.getByText("Your adaptive study map is ready.")).toBeInTheDocument();
    expect(screen.getByText("Group Trends")).toBeInTheDocument();
  });

  it("renders the dashboard shell", () => {
    renderWithAuth(
      <DashboardScreen
        plan={[
          {
            subtopic_id: 1,
            subtopic_title: "Group Trends",
            group_name: "group1",
            current_level: "beginner",
            is_overdue: false,
            last_quiz_score: 45,
            last_studied_date: null,
            type: "weak"
          }
        ]}
        progress={[
          {
            id: 1,
            subtopic_id: 1,
            current_level: "beginner",
            last_studied_date: null,
            last_quiz_score: 45,
            total_sessions: 2,
            subtopics: {
              id: 1,
              title: "Group Trends",
              group_name: "group1"
            },
            session_history: []
          }
        ]}
      />
    );
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Today's study plan")).toBeInTheDocument();
  });

  it("renders progress, webcam, behaviour, and settings screens", () => {
    renderWithAuth(
      <div>
        <ProgressScreen
          progress={[
            {
              id: 1,
              subtopic_id: 1,
              current_level: "intermediate",
              last_studied_date: null,
              last_quiz_score: 67,
              total_sessions: 3,
              subtopics: { id: 1, title: "Group Trends", group_name: "group1" },
              session_history: []
            }
          ]}
        />
        <WebcamCheckScreen />
        <BehaviourLogsScreen
          sessions={[
            {
              id: 1,
              student_id: 1,
              subtopic_id: 1,
              session_date: "2026-06-23",
              quiz_score: 82,
              focus_score: 88,
              phone_percent: 0,
              drowsy_percent: 10,
              away_percent: 15,
              talking_percent: 5,
              absent_percent: 0,
              webcam_enabled: true,
              total_questions: 15,
              correct_answers: 12,
              created_at: "2026-06-23T10:00:00Z",
              subtopics: { id: 1, title: "Group Trends", group_name: "group1" }
            }
          ]}
        />
        <SettingsScreen />
      </div>
    );

    expect(screen.getByText("Learning map")).toBeInTheDocument();
    expect(screen.getByText("Camera preview")).toBeInTheDocument();
    expect(screen.getByText("Behaviour logs")).toBeInTheDocument();
    expect(screen.getByText("Session controls")).toBeInTheDocument();
  });
});
