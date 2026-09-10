"use client";

import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  Check,
  Database,
  FlaskConical,
  Gauge,
  Menu,
  ShieldCheck,
  Sparkles
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/use-auth";

const studentLoop = [
  {
    number: "01",
    icon: FlaskConical,
    title: "Find the starting point",
    text: "A diagnostic assessment maps the learner across the A-Level chemistry syllabus before a study route is assigned."
  },
  {
    number: "02",
    icon: BookOpenCheck,
    title: "Practice with context",
    text: "Generated quizzes and explanations stay grounded in reviewed chemistry notes through retrieval-augmented generation."
  },
  {
    number: "03",
    icon: CalendarClock,
    title: "Plan the next move",
    text: "Knowledge tracing, deadlines, and focus evidence rank the most useful subtopic for the learner to study next."
  }
];

const evidence = [
  {
    value: "0.6822",
    label: "DKT ROC-AUC",
    detail: "Held-out mastery benchmark"
  },
  {
    value: "55",
    label: "Grounding chunks",
    detail: "Embedded chemistry notes"
  },
  {
    value: "76.0%",
    label: "Token accuracy",
    detail: "QLoRA proof run"
  },
  {
    value: "40",
    label: "Diagnostic checks",
    detail: "Across 10 subtopics"
  }
];

const intelligenceLayers = [
  {
    icon: Gauge,
    title: "Mastery estimation",
    text: "DKT reads answer history as a sequence. BKT remains an interpretable baseline and resilient fallback."
  },
  {
    icon: Database,
    title: "Grounded retrieval",
    text: "Supabase pgvector retrieves relevant curriculum notes before explanations are generated."
  },
  {
    icon: BrainCircuit,
    title: "Controlled generation",
    text: "Vertex AI supports live generation while the Qwen2.5-7B QLoRA adapter serves the quiz-generation path."
  },
  {
    icon: ShieldCheck,
    title: "Reviewed decisions",
    text: "Generated questions are checked before delivery, and deterministic rules keep the study route dependable."
  }
];

const stack = [
  "Next.js 15",
  "React 19",
  "FastAPI",
  "Supabase",
  "pgvector",
  "Vertex AI",
  "Qwen 2.5",
  "DKT + BKT"
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
      : "Start learning";

  return (
    <main className="landing-page">
      <header className="landing-nav-wrap">
        <div className="landing-nav landing-shell">
          <a className="landing-brand" href="/" aria-label="EduFX home">
            <span className="landing-brand__mark">Fx</span>
            <span className="landing-brand__copy">
              <strong>EduFX</strong>
              <small>Adaptive chemistry learning</small>
            </span>
          </a>

          <nav className="landing-nav__links" aria-label="Landing navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#intelligence">Intelligence</a>
            <a href="#evidence">Evidence</a>
          </nav>

          <div className="landing-nav__actions">
            <Button variant="ghost" href="/login">
              Sign in
            </Button>
            <Button href={workspaceHref} icon={<ArrowRight size={16} />}>
              {workspaceLabel}
            </Button>
            <button className="landing-nav__menu" type="button" aria-label="Open navigation">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-shell">
          <div className="landing-hero__stage">
            <Image
              src="/landing/hero-chemistry-adaptive.png"
              alt="A modern chemistry workspace with the EduFX learning dashboard"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 1440px"
              className="landing-hero__image"
            />
            <div className="landing-hero__shade" />

            <div className="landing-hero__content">
              <span className="landing-kicker">
                <BadgeCheck size={15} />
                Adaptive A-Level chemistry
              </span>
              <h1 id="landing-title">EduFX</h1>
              <p className="landing-hero__tagline">
                Know what to study next.
              </p>
              <p className="landing-hero__summary">
                Diagnostic evidence, grounded explanations, and knowledge tracing
                come together in one focused learning route.
              </p>
              <div className="landing-hero__actions">
                <Button href={workspaceHref} icon={<ArrowRight size={17} />}>
                  {workspaceLabel}
                </Button>
                <a className="landing-text-link" href="#how-it-works">
                  See how it works <ArrowRight size={15} />
                </a>
              </div>
            </div>

            <div className="landing-hero__proof" aria-label="EduFX platform summary">
              <div>
                <span>Learning route</span>
                <strong>Diagnostic to daily plan</strong>
              </div>
              <div className="landing-hero__proof-items">
                <span><Check size={14} /> Grounded</span>
                <span><Check size={14} /> Measured</span>
                <span><Check size={14} /> Student-specific</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-evidence-rail" id="evidence" aria-label="Measured platform evidence">
        <div className="landing-shell landing-evidence-rail__grid">
          {evidence.map((item) => (
            <div key={item.label} className="landing-evidence-item">
              <strong>{item.value}</strong>
              <div>
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section--white" id="how-it-works">
        <div className="landing-shell">
          <div className="landing-section-heading">
            <div>
              <span className="landing-section-label">The student loop</span>
              <h2>One clear path from uncertainty to action.</h2>
            </div>
            <p>
              EduFX does not ask learners to browse a large content library and guess.
              It evaluates, supports, and schedules the next useful step.
            </p>
          </div>

          <div className="landing-loop">
            {studentLoop.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.number} className="landing-loop__step">
                  <div className="landing-loop__meta">
                    <span>{item.number}</span>
                    <Icon size={20} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--soft" id="intelligence">
        <div className="landing-shell landing-intelligence">
          <div className="landing-intelligence__story">
            <span className="landing-section-label">Intelligence with evidence</span>
            <h2>AI supports the decision. It does not hide the reasoning.</h2>
            <p>
              The platform combines measured models with explicit product rules.
              Every recommendation can be traced back to performance, timing,
              curriculum context, or an optional focus signal.
            </p>

            <div className="landing-model-comparison">
              <div>
                <span>Deep knowledge tracing</span>
                <strong>DKT</strong>
                <small>0.6822 ROC-AUC</small>
              </div>
              <ArrowRight size={18} />
              <div>
                <span>Interpretable baseline</span>
                <strong>BKT</strong>
                <small>0.6569 ROC-AUC</small>
              </div>
            </div>
          </div>

          <div className="landing-intelligence__layers">
            {intelligenceLayers.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="landing-intelligence__layer">
                  <span className="landing-intelligence__icon"><Icon size={19} /></span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--white">
        <div className="landing-shell landing-training">
          <div className="landing-training__visual">
            <BarChart3 size={24} />
            <div className="landing-training__chart" aria-hidden="true">
              <span style={{ height: "34%" }} />
              <span style={{ height: "52%" }} />
              <span style={{ height: "68%" }} />
              <span style={{ height: "83%" }} />
            </div>
            <div>
              <small>QLoRA validation loss</small>
              <strong>1.2146 → 1.0471</strong>
            </div>
          </div>

          <div className="landing-training__copy">
            <span className="landing-section-label">Built and measured</span>
            <h2>A real training pipeline, presented honestly.</h2>
            <p>
              Qwen2.5-7B-Instruct was fine-tuned with QLoRA on Colab Enterprise.
              DKT and BKT were trained and compared on held-out simulated histories.
              The results prove the pipelines work; broader real-student validation
              remains the next research step.
            </p>
            <a className="landing-text-link landing-text-link--dark" href="#stack">
              View the implementation stack <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </section>

      <section className="landing-stack-band" id="stack">
        <div className="landing-shell">
          <div className="landing-stack-band__heading">
            <div>
              <Sparkles size={20} />
              <span>Platform stack</span>
            </div>
            <p>Modern web delivery with a Python AI service and grounded data layer.</p>
          </div>
          <div className="landing-stack-band__items">
            {stack.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-shell landing-cta__panel">
          <div>
            <span className="landing-section-label">Your next topic is waiting</span>
            <h2>Start with evidence. Study with direction.</h2>
          </div>
          <Button href={workspaceHref} icon={<ArrowRight size={17} />}>
            {workspaceLabel}
          </Button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-shell">
          <a className="landing-brand" href="/">
            <span className="landing-brand__mark">Fx</span>
            <span className="landing-brand__copy">
              <strong>EduFX</strong>
              <small>Adaptive chemistry learning</small>
            </span>
          </a>
          <p>Built for focused A-Level chemistry study.</p>
        </div>
      </footer>
    </main>
  );
}
