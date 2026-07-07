import { describe, expect, it } from "vitest";

import { parseTeacherText } from "./teacher-response";

describe("parseTeacherText", () => {
  it("turns markdown-like report output into clean teacher sections", () => {
    const parsed = parseTeacherText(`### Where you are
Hi Thanoban, **nice progress** so far.

### What to work on
Based on your data, focus on group1-atomic-radius-trend.

### How to improve
- Revisit the trend notes, then practise five questions.`);

    expect(parsed.sections).toEqual([
      {
        title: "Where you are",
        paragraphs: ["Hi Thanoban, nice progress so far."],
      },
      {
        title: "What to work on",
        paragraphs: ["focus on group1-atomic-radius-trend."],
      },
      {
        title: "How to improve",
        paragraphs: ["Revisit the trend notes, then practise five questions."],
      },
    ]);
  });
});
