import { CheckCircle2 } from "lucide-react";

type TeacherSection = {
  title: string;
  paragraphs: string[];
};

type ParsedTeacherText = {
  sections: TeacherSection[];
  paragraphs: string[];
};

const STRUCTURED_SECTION_TITLES = [
  "Where you are",
  "What to work on",
  "How to improve",
  "Short answer",
  "Your weak spots",
  "What to practise",
  "Try this",
  "Next step",
];

function cleanTeacherLine(value: string) {
  return value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\bBased on your data,\s*/gi, "")
    .replace(/\bbased on your data,\s*/g, "")
    .replace(/\bLooking at your data,\s*/gi, "")
    .trim();
}

function isReportSectionTitle(line: string) {
  const normalized = line.replace(/[:.]+$/, "").toLowerCase();
  return STRUCTURED_SECTION_TITLES.find((title) => title.toLowerCase() === normalized);
}

export function parseTeacherText(text: string): ParsedTeacherText {
  const lines = text
    .split(/\r?\n/)
    .map(cleanTeacherLine)
    .filter(Boolean);

  const sections: TeacherSection[] = [];
  const fallbackParagraphs: string[] = [];
  let activeSection: TeacherSection | null = null;

  for (const line of lines) {
    const title = isReportSectionTitle(line);
    if (title) {
      activeSection = { title, paragraphs: [] };
      sections.push(activeSection);
      continue;
    }

    if (activeSection) {
      activeSection.paragraphs.push(line);
    } else {
      fallbackParagraphs.push(line);
    }
  }

  return {
    sections: sections.filter((section) => section.paragraphs.length > 0),
    paragraphs: fallbackParagraphs,
  };
}

export function TeacherResponse({
  content,
  variant = "chat",
}: {
  content: string;
  variant?: "report" | "chat";
}) {
  const parsed = parseTeacherText(content);

  if (parsed.sections.length > 0) {
    return (
      <div className={variant === "report" ? "teacher-report-grid" : "teacher-section-stack"}>
        {parsed.sections.map((section) => (
          <article className="teacher-section" key={section.title}>
            <div className="teacher-section__header">
              <span className="teacher-section__icon">
                <CheckCircle2 size={15} />
              </span>
              <h4>{section.title}</h4>
            </div>
            <div className="teacher-prose">
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.title}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="teacher-prose">
      {parsed.paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
