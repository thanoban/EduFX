"use client";

import Image from "next/image";
import {
  ArrowRight,
  Atom,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  Database,
  Eye,
  FlaskConical,
  Orbit,
  ShieldCheck,
  Sparkles
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";

const studentExperience = [
  {
    icon: <FlaskConical size={18} />,
    eyebrow: "Diagnostic placement",
    title: "Students begin with evidence, not guesswork.",
    detail:
      "EduFX places each learner across all 10 S-block subtopics before generating any study route."
  },
  {
    icon: <Sparkles size={18} />,
    eyebrow: "Generated support",
    title: "Quizzes and explanations are grounded in chemistry notes.",
    detail:
      "Quiz generation, retrieval, and explanation stay connected so practice feels consistent and academically relevant."
  },
  {
    icon: <Eye size={18} />,
    eyebrow: "Behaviour-aware feedback",
    title: "Focus signals shape the next decision.",
    detail:
      "Away, phone, drowsy, and attention cues help EduFX interpret scores in context instead of reading marks alone."
  }
];

const technicalPillars = [
  {
    icon: <Atom size={18} />,
    title: "Knowledge tracing core",
    text:
      "Diagnostic data, quiz history, and behaviour signals feed DKT first, then BKT and deterministic fallback rules."
  },
  {
    icon: <Database size={18} />,
    title: "Retrieval and persistence",
    text:
      "Supabase stores curriculum entities, learner progress, attempts, and pgvector embeddings for grounded retrieval."
  },
  {
    icon: <BrainCircuit size={18} />,
    title: "AI generation layer",
    text:
      "Vertex AI powers live generation and embeddings, while the fine-tuned Qwen adapter supports the quiz path."
  },
  {
    icon: <CalendarClock size={18} />,
    title: "Adaptive scheduling",
    text:
      "Weak, overdue, and ready-to-learn subtopics are ranked into a realistic next-step plan for the student."
  }
];

const proofCards = [
  {
    kicker: "Knowledge tracing",
    title: "DKT currently leads the mastery benchmark.",
    body:
      "The present evaluation records 0.6822 ROC-AUC for DKT versus 0.6569 for BKT, which supports the current ordering."
  },
  {
    kicker: "Fine-tuning",
    title: "QLoRA training completed on NVIDIA L4.",
    body:
      "The Qwen2.5-7B-Instruct adapter finished in 263 seconds with validation loss reduced to 1.0471 on the current proof set."
  },
  {
    kicker: "Retrieval",
    title: "Chemistry explanations are backed by note embeddings.",
    body:
      "EduFX currently serves 55 embedded S-block content chunks from Supabase pgvector to ground explanation responses."
  }
];

const journeySteps = [
  {
    label: "01",
    title: "Place the learner",
    text:
      "EduFX starts with a diagnostic sweep across the chemistry syllabus so the platform knows what is actually weak."
  },
  {
    label: "02",
    title: "Ground the response",
    text:
      "RAG-backed explanations and fine-tuned quiz prompts stay tied to chemistry notes instead of producing generic help."
  },
  {
    label: "03",
    title: "Recommend the next move",
    text:
      "DKT, BKT, and behaviour cues shape the next subtopic, timing, and revision priority without handing content choice to chance."
  }
];

const credibilityStats = [
  { value: "10", label: "A-Level subtopics", note: "Group 1 and Group 2 S-block coverage" },
  { value: "55", label: "RAG content chunks", note: "Retrieved from the chemistry note corpus" },
  { value: "0.6822", label: "DKT ROC-AUC", note: "Held-out mastery benchmark" },
  { value: "263s", label: "Fine-tune runtime", note: "Colab Enterprise on NVIDIA L4" }
];

const stackItems = [
  "Next.js 15 + React 19 frontend",
  "FastAPI layered MVC backend",
  "Supabase PostgreSQL + pgvector",
  "Google OAuth through Supabase Auth",
  "Vertex AI Gemini 2.5 Flash",
  "Qwen2.5-7B QLoRA adapter"
];

export function LandingPage() {
  const { student, loading } = useAuth();
  const workspaceHref = student
    ? student.diagnostic_completed
      ? "/dashboard"
      : "/diagnostic"
    : "/login";
  const workspaceLabel = loading
    ? "Open workspace"
    : student
      ? student.diagnostic_completed
        ? "Go to dashboard"
        : "Continue diagnostic"
      : "Open workspace";

  return (
    <main className="landing-page">
      <h2
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0
        }}
      >
        EduFX
      </h2>

      <section className="landing-hero">
        <div className="landing-shell">
          <header className="landing-nav">
            <a className="landing-brand" href="/">
              <span className="landing-brand__mark">Fx</span>
              <span className="landing-brand__copy">
                <strong>EduFX</strong>
                <small>Adaptive chemistry workspace</small>
              </span>
            </a>

            <nav className="landing-nav__links" aria-label="Landing navigation">
              <a href="#product">Product</a>
              <a href="#intelligence">Intelligence</a>
              <a href="#evidence">Evidence</a>
              <a href="#stack">Stack</a>
            </nav>

            <div className="landing-nav__actions">
              <span className="landing-nav__status">
                <BadgeCheck size={14} /> Live adaptive flow
              </span>
              <Button variant="ghost" href="/login">
                Sign in
              </Button>
            </div>
          </header>

          <div className="landing-hero-panel">
            <div className="landing-hero-copy">
              <span className="landing-pill">
                <ShieldCheck size={14} /> Diagnostic placement, grounded explanations,
                and adaptive study planning
              </span>

              <h1>EduFX helps chemistry students study the right thing at the right time.</h1>

              <p className="landing-hero-copy__lead">
                This is not a generic content portal. EduFX turns student performance,
                knowledge tracing, retrieval context, and behaviour signals into a clear
                next-step study route.
              </p>

              <p className="landing-hero-copy__body">
                Students move from diagnostic placement to guided practice, grounded
                explanations, and scheduler-driven recommendations powered by DKT, BKT,
                Supabase, Vertex AI, and a fine-tuned quiz generation path.
              </p>

              <div className="landing-hero-copy__actions">
                <Button href={workspaceHref} icon={<ArrowRight size={16} />}>
                  {workspaceLabel}
                </Button>
                <Button variant="secondary" href="#product">
                  Explore the platform
                </Button>
              </div>

              <div className="landing-hero-signal-row">
                <div className="landing-hero-signal">
                  <span>
                    <BarChart3 size={15} />
                    Measured models
                  </span>
                  <strong>DKT 0.6822 ROC-AUC</strong>
                </div>
                <div className="landing-hero-signal">
                  <span>
                    <Orbit size={15} />
                    Grounded AI
                  </span>
                  <strong>55 chemistry note chunks</strong>
                </div>
              </div>
            </div>

            <div className="landing-hero-visual">
              <div className="landing-hero-visual__frame">
                <Image
                  src="/landing/hero-chemistry-adaptive.png"
                  alt="EduFX adaptive chemistry study environment"
                  fill
                  priority
                  sizes="(max-width: 960px) 100vw, 48vw"
                  className="landing-hero-visual__image"
                />
              </div>

              <div className="landing-floating-card landing-floating-card--top">
                <span className="landing-floating-card__eyebrow">Adaptive route</span>
                <strong>Recommendations stay under EduFX control.</strong>
                <p>
                  Learners are guided into the next best subtopic using mastery
                  evidence and timing logic instead of browsing content at random.
                </p>
              </div>

              <div className="landing-floating-card landing-floating-card--bottom">
                <div>
                  <span className="landing-floating-card__eyebrow">Live loop</span>
                  <strong>Diagnostic to study plan</strong>
                </div>
                <div className="landing-floating-card__chips">
                  <span>40-question placement</span>
                  <span>RAG-backed support</span>
                  <span>Behaviour-aware review</span>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-journey-grid">
            {journeySteps.map((item) => (
              <article key={item.label} className="landing-journey-card">
                <span className="landing-journey-card__label">{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>

          <div className="landing-stat-grid">
            {credibilityStats.map((item) => (
              <article key={item.label} className="landing-stat-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
                <small>{item.note}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--light" id="product">
        <div className="landing-shell">
          <div className="landing-section__intro">
            <span className="eyebrow">Student experience</span>
            <h2>An academic product flow, not a decorative AI wrapper.</h2>
            <p className="muted">
              EduFX was built around the actual decisions a chemistry learner needs:
              where to start, what to practice next, why an answer is wrong, and when
              to revisit a weak concept.
            </p>
          </div>

          <div className="landing-card-grid landing-card-grid--three landing-card-grid--offset">
            {studentExperience.map((item) => (
              <article key={item.title} className="landing-feature-card">
                <span className="landing-feature-card__icon">{item.icon}</span>
                <span className="landing-feature-card__eyebrow">{item.eyebrow}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--tint" id="intelligence">
        <div className="landing-shell">
          <div className="landing-intelligence-layout">
            <div className="landing-section__intro landing-section__intro--sticky">
              <span className="eyebrow">Technical implementation</span>
              <h2>Modern product surface, credible AI pipeline underneath.</h2>
              <p className="muted">
                The landing page should reflect the real repo: a Next.js frontend, a
                FastAPI service layer, Supabase-backed persistence, chemistry note
                retrieval, and measured models rather than vague “AI-powered” claims.
              </p>
            </div>

            <div className="landing-card-grid landing-card-grid--two">
              {technicalPillars.map((item) => (
                <article key={item.title} className="landing-technical-card">
                  <span className="landing-feature-card__icon">{item.icon}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="landing-stack-panel" id="stack">
            <div className="landing-stack-panel__copy">
              <span className="eyebrow">Delivery stack</span>
              <h3>Built to demo clearly, extend safely, and explain well in a viva.</h3>
            </div>
            <div className="landing-stack-grid">
              {stackItems.map((item) => (
                <div key={item} className="landing-stack-grid__item">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--light" id="evidence">
        <div className="landing-shell">
          <div className="landing-section__intro">
            <span className="eyebrow">Evidence</span>
            <h2>Real project numbers are part of the story.</h2>
            <p className="muted">
              EduFX already includes working retrieval content, evaluated
              knowledge-tracing models, and a completed fine-tuning pipeline. The
              public page should surface those facts with confidence.
            </p>
          </div>

          <div className="landing-card-grid landing-card-grid--three">
            {proofCards.map((item) => (
              <article key={item.title} className="landing-proof-card">
                <span className="landing-feature-card__eyebrow">{item.kicker}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-shell">
          <div className="landing-cta__panel">
            <div className="landing-cta__copy">
              <span className="eyebrow">Ready to enter the workspace?</span>
              <h2>See the system, then step straight into the adaptive loop.</h2>
              <p>
                Open the sign-in flow, continue a diagnostic, or jump into the dashboard
                if your learning profile is already active.
              </p>
            </div>

            <div className="landing-cta__actions">
              <Button href={workspaceHref} icon={<ArrowRight size={16} />}>
                {workspaceLabel}
              </Button>
              <Button variant="secondary" href="/login">
                Open sign-in
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
