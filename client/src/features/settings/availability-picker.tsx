"use client";

import type { SessionLength, StudentProfile } from "@/types/contracts";

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const SESSION_LENGTH_OPTIONS: Array<{ value: SessionLength; label: string }> = [
  { value: "short", label: "15–20 min" },
  { value: "medium", label: "30–45 min" },
  { value: "long", label: "1hr+" }
];

/** Build the per-day map from the profile, falling back to the old single
 * session-length (applied to every free day) for students saved before per-day
 * availability existed, or an empty map for a brand-new onboarding student. */
export function initialDayLengths(student: StudentProfile | null): Record<number, SessionLength> {
  const stored = student?.day_session_length ?? {};
  if (Object.keys(stored).length > 0) {
    const out: Record<number, SessionLength> = {};
    for (const [day, length] of Object.entries(stored)) {
      out[Number(day)] = length;
    }
    return out;
  }
  const fallback: Record<number, SessionLength> = {};
  for (const day of student?.free_days ?? []) {
    fallback[day] = student?.session_length ?? "medium";
  }
  return fallback;
}

/** Shared per-day free-time picker UI, used by both Settings and the
 * onboarding availability step so the two never drift apart. */
export function AvailabilityDayList({
  dayLengths,
  onSetDay
}: {
  dayLengths: Record<number, SessionLength>;
  onSetDay: (day: number, length: SessionLength | null) => void;
}) {
  return (
    <div className="list">
      {DAY_LABELS.map((label, day) => {
        const selected = dayLengths[day];
        return (
          <div key={label} className="list-item cluster" style={{ justifyContent: "space-between" }}>
            <strong style={{ width: 44 }}>{label}</strong>
            <div className="cluster">
              <button
                type="button"
                className={`pill ${selected === undefined ? "success" : ""}`.trim()}
                onClick={() => onSetDay(day, null)}
              >
                Off
              </button>
              {SESSION_LENGTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`pill ${selected === option.value ? "success" : ""}`.trim()}
                  onClick={() => onSetDay(day, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Derive the `updateAvailability` request body from the picker's state. */
export function buildAvailabilityPayload(
  dayLengths: Record<number, SessionLength>
) {
  const freeDays = Object.keys(dayLengths).map(Number).sort((a, b) => a - b);
  // `session_length` stays as a fallback default for any day without a
  // per-day value; use the first selected day's choice, else medium.
  const defaultLength = freeDays.length > 0 ? dayLengths[freeDays[0]] : "medium";
  return {
    free_days: freeDays,
    session_length: defaultLength,
    day_session_length: dayLengths
  };
}
