import React from "react";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BehaviourLogsScreen } from "@/features/behaviour/behaviour-logs-screen";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
import { DiagnosticResultsScreen } from "@/features/diagnostic/diagnostic-results-screen";
import { LandingPage } from "@/features/marketing/landing-page";
import { LoginScreen } from "@/features/auth/login-screen";
import { ProgressScreen } from "@/features/progress/progress-screen";
import { ResultsScreen } from "@/features/results/results-screen";
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
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
  });

  it("renders the landing page", () => {
    renderWithAuth(<LandingPage />, { student: null });
    expect(screen.getByRole("heading", { name: "EduFX" })).toBeInTheDocument();
    expect(screen.getByText("Technical implementation")).toBeInTheDocument();
    expect(screen.getByText("Real project numbers are part of the story.")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
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

  it("renders the results screen even when explanations are still pending", () => {
    renderWithAuth(
      <ResultsScreen
        results={{
          id: 6,
          student_id: 1,
          subtopic_id: 1,
          quiz_score: 73,
          focus_score: 81,
          phone_percent: 0,
          drowsy_percent: 5,
          away_percent: 12,
          talking_percent: 0,
          absent_percent: 0,
          webcam_enabled: true,
          total_questions: 2,
          correct_answers: 1,
          attempts: [
            {
              id: 10,
              question_id: 20,
              student_answer: "B",
              correct_answer: "A",
              is_correct: false,
              explanation: null,
              question: {
                id: 20,
                subtopic_id: 1,
                question_text: "What happens to atomic radius down Group 1?",
                option_a: "Increases",
                option_b: "Decreases",
                option_c: "Stays the same",
                option_d: "No obvious trend",
                correct_answer: "A",
                difficulty: "easy",
                source: "seed",
                stage: "generated",
                student_id: null
              }
            }
          ]
        }}
        lastQuizResult={null}
      />
    );

    expect(screen.getByText("Session complete")).toBeInTheDocument();
    expect(screen.getByText("Explanation pending")).toBeInTheDocument();
  });
});
