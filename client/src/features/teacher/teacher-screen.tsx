"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap, RefreshCw, Send, Sparkles } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { useAuthGuard } from "@/features/auth/use-auth-guard";
import { teacherApi } from "@/lib/api";
import type { TeacherChatMessage } from "@/types/contracts";
import { TeacherResponse } from "./teacher-response";

const SUGGESTIONS = [
  "What are my weaknesses?",
  "How am I doing so far?",
  "What should I work on to improve?"
];

export function TeacherScreen() {
  const { student } = useAuthGuard();
  const studentId = student?.student_id;

  const [report, setReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [messages, setMessages] = useState<TeacherChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  async function loadReport() {
    if (!studentId) return;
    setReportLoading(true);
    try {
      const data = await teacherApi.getReport(studentId);
      setReport(data.report);
    } catch {
      setReport("I couldn't put your report together just now. Try again in a moment.");
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !studentId || sending) return;
    const history = messages;
    const nextMessages: TeacherChatMessage[] = [...history, { role: "student", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    try {
      const data = await teacherApi.chat(studentId, trimmed, history);
      setMessages([...nextMessages, { role: "teacher", content: data.reply }]);
    } catch {
      setMessages([
        ...nextMessages,
        { role: "teacher", content: "I couldn't answer just now. Please try again in a moment." }
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell
      title="AI Teacher"
      subtitle="Ask about your progress, weak spots, and what to practise next."
      action={
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={loadReport} disabled={reportLoading}>
          {reportLoading ? "Refreshing…" : "Refresh report"}
        </Button>
      }
    >
      <SectionCard title="Your progress report" eyebrow="Teacher summary" action={<Sparkles size={18} />}>
        {reportLoading && !report ? (
          <div className="muted">Reading your recent work and preparing your report...</div>
        ) : (
          <TeacherResponse content={report ?? ""} variant="report" />
        )}
      </SectionCard>

      <div style={{ marginTop: 24 }}>
        <SectionCard title="Ask your teacher" eyebrow="Teacher guidance" action={<GraduationCap size={18} />}>
          <div className="stack">
            <div
              ref={threadRef}
              className="stack"
              style={{ maxHeight: 380, overflowY: "auto", gap: 12, paddingRight: 4 }}
            >
              {messages.length === 0 ? (
                <div className="cluster" style={{ flexWrap: "wrap", gap: 8 }}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" className="pill" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`teacher-message ${m.role === "student" ? "teacher-message--student" : ""}`.trim()}
                >
                  <div className="muted small-text" style={{ marginBottom: 4 }}>
                    {m.role === "student" ? "You" : "Teacher"}
                  </div>
                  <TeacherResponse content={m.content} />
                </div>
              ))}
              {sending ? <div className="muted">Teacher is thinking...</div> : null}
            </div>

            <form
              className="cluster"
              style={{ gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <input
                className="field__input"
                style={{ flex: 1 }}
                placeholder="Ask about your progress, mistakes, or how to improve..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
              />
              <Button icon={<Send size={16} />} disabled={sending || !input.trim()}>
                Send
              </Button>
            </form>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
