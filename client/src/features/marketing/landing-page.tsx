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
  Layers3,
  Orbit,
  ShieldCheck,
  Sparkles,
  Target,
  Waypoints
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";

const productFlow = [
  {
    icon: <Layers3 size={18} />,
    label: "Placement first",
    title: "40-question diagnostic across all 10 S-block subtopics",
    detail:
      "EduFX maps each learner to a starting level before any plan is generated, so recommendations begin from evidence instead of assumptions."
  },
  {
    icon: <Sparkles size={18} />,
    label: "Generation with grounding",
    title: "Quiz generation plus RAG-backed explanations",
    detail:
      "Task A uses the fine-tuned quiz path, while Task B explanations stay grounded with Vertex AI and chemistry note retrieval from pgvector."
  },
  {
    icon: <Eye size={18} />,
    label: "Behaviour aware",
    title: "Focus signals feed the study loop",
    detail:
      "Away, phone, drowsy, talking, and absence signals are captured so progress is interpreted together with attention quality, not just raw marks."
  },
  {
    icon: <CalendarClock size={18} />,
    label: "Next-step planning",
    title: "DKT, BKT, and scheduling logic decide what comes next",
    detail:
      "The scheduler ranks weak, overdue, and ready-to-learn subtopics to produce a realistic daily plan instead of a flat topic list."
  }
];

const technicalPillars = [
  {
    icon: <Atom size={18} />,
    title: "Adaptive student model",
    text:
      "Diagnostic placement, quiz history, and behaviour data feed a knowledge-tracing pipeline that prefers DKT, falls back to BKT, and then to deterministic rules."
  },
  {
    icon: <Database size={18} />,
    title: "Retrieval and persistence",
    text:
      "Supabase stores curriculum data, sessions, attempts, progress, and pgvector embeddings so explanations can cite the right chemistry content at runtime."
  },
  {
    icon: <BrainCircuit size={18} />,
    title: "AI services",
    text:
      "Vertex AI Gemini handles live generation and embeddings, while the QLoRA-tuned Qwen adapter is wired for the quiz-generation path through a separate inference endpoint."
  },
  {
    icon: <Waypoints size={18} />,
    title: "Deployment path",
    text:
      "Next.js 15 on the frontend, FastAPI on the backend, GitHub Actions for delivery, and Cloud Run plus optional GPU inference keep the architecture demo-ready and extensible."
  }
];

const evidenceCards = [
  { value: "10", label: "A-Level chemistry subtopics", note: "Group 1 and Group 2 S-block coverage" },
  { value: "55", label: "Embedded RAG chunks", note: "Stored in Supabase pgvector from the note corpus" },
  { value: "0.6822", label: "Held-out DKT ROC-AUC", note: "Compared against BKT at 0.6569 on the KT benchmark" },
  { value: "263s", label: "QLoRA fine-tune runtime", note: "Qwen2.5-7B-Instruct on Colab Enterprise NVIDIA L4" }
];

const stackItems = [
  "Next.js 15 · React 19 · TypeScript",
  "FastAPI layered MVC backend",
  "Supabase PostgreSQL + pgvector",
  "Google OAuth through Supabase Auth",
  "Vertex AI Gemini 2.5 Flash + gemini-embedding-001",
  "Qwen2.5-7B QLoRA adapter for quiz generation"
];

const heroSignals = [
  {
    icon: <Target size={16} />,
    label: "Adaptive loop",
    value: "Diagnostic to schedule"
  },
  {
    icon: <BarChart3 size={16} />,
    label: "Measured models",
    value: "DKT 0.6822 ROC-AUC"
  },
  {
    icon: <Orbit size={16} />,
    label: "Grounded AI",
    value: "55 retrieved note chunks"
  }
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
      <section className="landing-hero">
        <div className="landing-hero__shell">
          <header className="landing-nav">
            <a className="landing-brand" href="/">
              <span className="landing-brand__mark">Fx</span>
              <span className="landing-brand__copy">
                <strong>EduFX</strong>
                <small>Adaptive chemistry intelligence</small>
              </span>
            </a>
            <nav className="landing-nav__links" aria-label="Landing navigation">
              <a href="#platform">Platform</a>
              <a href="#intelligence">Intelligence</a>
              <a href="#evidence">Evidence</a>
              <a href="#architecture">Architecture</a>
            </nav>
            <div className="landing-nav__actions">
              <span className="landing-nav__status">
                <BadgeCheck size={14} /> Live product flow
              </span>
              <Button variant="ghost" href="/login">
                Sign in
              </Button>
            </div>
          </header>

          <div className="landing-hero__stage">
            <Image
              src="/landing/hero-lab-dark.png"
              alt="EduFX chemistry workspace illustration"
              fill
              priority
              sizes="100vw"
              className="landing-hero__image"
            />
            <div className="landing-hero__overlay" />

            <div className="landing-hero__content">
              <div className="landing-hero__copy">
                <span className="landing-badge">
                  <ShieldCheck size={14} /> Vertex AI, RAG, KT, and behaviour-aware planning
                </span>
                <h1>EduFX</h1>
                <p className="landing-hero__lead">
                  Adaptive A-Level chemistry learning with product-grade UX and a
                  measurable intelligence stack underneath.
                </p>
                <p className="landing-hero__body">
                  Students move from diagnostic placement to personalized study plans,
                  grounded explanations, focus-aware feedback, and scheduler decisions
                  powered by DKT, BKT, Supabase, Vertex AI, and a fine-tuned quiz model.
                </p>
                <div className="landing-hero__actions">
                  <Button href={workspaceHref} icon={<ArrowRight size={16} />}>
                    {workspaceLabel}
                  </Button>
                  <Button variant="secondary" href="#intelligence">
                    Explore the system
                  </Button>
                </div>
                <div className="landing-hero__mini-stack">
                  {stackItems.slice(0, 3).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>

              <div className="landing-hero__visual">
                <div className="landing-preview">
                  <div className="landing-preview__panel">
                    <span className="landing-preview__eyebrow">Student loop</span>
                    <strong>Diagnostic to recommendation in one product path</strong>
                    <p>
                      The public story and the internal architecture stay aligned:
                      placement, retrieval, generation, behaviour logging, and
                      next-step scheduling all exist in the working app.
                    </p>
                  </div>
                  <div className="landing-preview__rail">
                    <div>
                      <span>40 questions</span>
                      <strong>Diagnostic placement</strong>
                    </div>
                    <div>
                      <span>55 chunks</span>
                      <strong>RAG explanation context</strong>
                    </div>
                    <div>
                      <span>0.6822 AUC</span>
                      <strong>DKT mastery prediction</strong>
                    </div>
                    <div>
                      <span>QLoRA adapter</span>
                      <strong>Fine-tuned quiz generation path</strong>
                    </div>
                  </div>
                </div>

                <div className="landing-system-card" aria-label="System overview">
                  <div className="landing-system-card__header">
                    <span className="landing-preview__eyebrow">System surface</span>
                    <strong>How EduFX turns raw study events into next actions</strong>
                  </div>
                  <div className="landing-system-card__grid">
                    {heroSignals.map((item) => (
                      <div key={item.label} className="landing-system-card__metric">
                        <span>{item.icon}</span>
                        <small>{item.label}</small>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="landing-system-card__timeline">
                    <div>
                      <span>Input</span>
                      <strong>Diagnostic, quiz attempts, focus summaries</strong>
                    </div>
                    <div>
                      <span>Decision layer</span>
                      <strong>RAG + generation + KT-driven scheduling</strong>
                    </div>
                    <div>
                      <span>Output</span>
                      <strong>Study plan, explanations, and review timing</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-stat-band" id="platform">
            {evidenceCards.map((item) => (
              <article key={item.label} className="landing-stat-band__item">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
                <small>{item.note}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--light">
        <div className="landing-section__inner">
          <div className="landing-section__intro">
            <span className="eyebrow">Learning flow</span>
            <h2>The product is designed around a full adaptive loop.</h2>
            <p className="muted">
              EduFX does not stop at quiz scoring. It uses the student’s diagnostic
              baseline, retrieval context, generated assessments, webcam-derived
              focus cues, and schedule history to decide what should happen next.
            </p>
          </div>

          <div className="landing-flow-grid">
            {productFlow.map((item) => (
              <article key={item.title} className="landing-flow-card">
                <span className="landing-flow-card__icon">{item.icon}</span>
                <span className="landing-flow-card__label">{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--dark" id="intelligence">
        <div className="landing-section__inner landing-intelligence">
          <div className="landing-section__intro landing-section__intro--light">
            <span className="eyebrow">Technical implementation</span>
            <h2>Modern product surface, credible AI pipeline underneath.</h2>
            <p>
              The landing page tells the same story as the repo: a Next.js
              frontend, a FastAPI service layer, Supabase-backed persistence,
              chemistry note retrieval, and a measured modeling stack rather than
              hand-wavy “AI-powered” claims.
            </p>
          </div>

          <div className="landing-pillar-grid">
            {technicalPillars.map((item) => (
              <article key={item.title} className="landing-pillar-card">
                <span className="landing-pillar-card__icon">{item.icon}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>

          <div className="landing-architecture-strip" id="architecture">
            <div className="landing-architecture-strip__copy">
              <span className="eyebrow">Delivery stack</span>
              <h3>Built to demo well, explain well, and extend well.</h3>
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
        <div className="landing-section__inner landing-proof">
          <div className="landing-section__intro">
            <span className="eyebrow">Evidence</span>
            <h2>Real project numbers are part of the story.</h2>
            <p className="muted">
              This implementation already includes a working chemistry note corpus,
              evaluated knowledge-tracing models, and a completed QLoRA fine-tuning
              run for quiz generation. The landing page surfaces those facts so the
              platform feels engineered, not only designed.
            </p>
          </div>

          <div className="landing-proof-grid">
            <article className="landing-proof-card">
              <span className="landing-proof-card__kicker">Knowledge tracing</span>
              <h3>DKT outperformed BKT on held-out ROC-AUC.</h3>
              <p>
                The current benchmark records <strong>0.6822</strong> for DKT and
                <strong> 0.6569</strong> for BKT, which supports using the deep model
                first while still keeping the interpretable baseline as fallback.
              </p>
            </article>
            <article className="landing-proof-card">
              <span className="landing-proof-card__kicker">Fine-tuning</span>
              <h3>QLoRA training completed on Colab Enterprise with NVIDIA L4.</h3>
              <p>
                The Qwen2.5-7B-Instruct adapter finished in <strong>263 seconds</strong>,
                validation loss dropped to <strong>1.0471</strong>, and token accuracy
                reached <strong>76.0%</strong> on the current proof-of-pipeline set.
              </p>
            </article>
            <article className="landing-proof-card">
              <span className="landing-proof-card__kicker">Retrieval</span>
              <h3>The explanation path is grounded in chemistry notes.</h3>
              <p>
                EduFX ingests <strong>55 embedded chunks</strong> from the S-block
                note set into Supabase pgvector so explanations can retrieve the
                relevant concept context before generation.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-cta__inner">
          <div className="landing-cta__copy">
            <span className="eyebrow">Ready to enter the workspace?</span>
            <h2>See the product, then step straight into the adaptive loop.</h2>
            <p>
              Open the login flow, continue a diagnostic, or jump into the dashboard
              if your study profile is already active.
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
      </section>
    </main>
  );
}
