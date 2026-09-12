import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  FlaskConical,
  Gauge,
  Layers3,
  LockKeyhole,
  Route,
  Sparkles,
} from "lucide-react";

const evidence = [
  { value: "40", label: "diagnostic checks", detail: "covers A-Level S-block subtopics" },
  { value: "55", label: "retrieved note chunks", detail: "used for grounded explanations" },
  { value: "0.6822", label: "DKT ROC-AUC", detail: "mastery prediction baseline" },
  { value: "76%", label: "fine-tune token accuracy", detail: "quiz-generation adapter result" },
];

const flow = [
  {
    icon: FlaskConical,
    title: "Diagnose the learner",
    text: "The first route starts with a structured chemistry diagnostic instead of asking students to choose random content.",
  },
  {
    icon: BrainCircuit,
    title: "Predict the weak point",
    text: "BKT and DKT use answers, timing, and focus context to estimate what needs practice next.",
  },
  {
    icon: BookOpenCheck,
    title: "Recommend one action",
    text: "EduFX turns the model result into one clear study item, followed by a quiz and grounded explanations.",
  },
];

const stack = [
  { icon: Layers3, label: "Next.js 15 frontend", detail: "responsive learning workspace" },
  { icon: LockKeyhole, label: "Supabase auth + database", detail: "student-owned data flow" },
  { icon: Route, label: "FastAPI MVC backend", detail: "quiz, progress, agents, scheduler" },
  { icon: Sparkles, label: "Groq AI fallback", detail: "production LLM path when Vertex is blocked" },
];

export default function HomePage() {
  return (
    <main className="edufx-landing">
      <header className="edufx-landing-nav">
        <a className="edufx-landing-brand" href="/" aria-label="EduFX home">
          <span>Fx</span>
          <div>
            <strong>EduFX</strong>
            <small>A-Level chemistry intelligence</small>
          </div>
        </a>
        <nav aria-label="Landing page sections">
          <a href="#flow">Flow</a>
          <a href="#models">Models</a>
          <a href="#tracking">Tracking</a>
          <a href="#stack">Stack</a>
        </nav>
        <a className="edufx-landing-nav__button" href="/login">Sign in</a>
      </header>

      <section className="edufx-landing-hero" aria-labelledby="landing-title">
        <img
          src="/landing/chemistry-lab-hero.jpg"
          alt="Modern chemistry lab workspace with glassware and study material"
          className="edufx-landing-hero__image"
        />
        <div className="edufx-landing-hero__shade" />
        <div className="edufx-landing-hero__content">
          <span className="edufx-landing-kicker">
            <Sparkles size={16} />
            Adaptive study platform
          </span>
          <h1 id="landing-title">EduFX guides every chemistry session from evidence to action.</h1>
          <p>
            Diagnostic results, mastery models, RAG explanations, and optional behaviour signals are combined
            into one next study route for each student.
          </p>
          <div className="edufx-landing-hero__actions">
            <a className="edufx-landing-button" href="/login">
              Open workspace
              <ArrowRight size={17} />
            </a>
            <a className="edufx-landing-link" href="#flow">See how it works</a>
          </div>
        </div>
        <aside className="edufx-landing-route-card" aria-label="Current recommendation example">
          <span>Next recommended action</span>
          <strong>Revise Group Trends</strong>
          <p>Selected from quiz accuracy, DKT/BKT mastery, spacing priority, and focus quality.</p>
          <div>
            <small>Beginner risk</small>
            <small>Due today</small>
          </div>
        </aside>
      </section>

      <section className="edufx-landing-evidence" aria-label="EduFX evidence metrics">
        {evidence.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="edufx-landing-section" id="flow">
        <div className="edufx-landing-section__head">
          <span className="edufx-landing-kicker">Student flow</span>
          <h2>No content picker. One recommended route.</h2>
          <p>
            EduFX is designed for students who need guidance, not another library to browse. The system decides
            what comes next from measurable learning evidence.
          </p>
        </div>
        <div className="edufx-landing-flow">
          {flow.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title}>
                <Icon size={26} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="edufx-landing-models" id="models">
        <div>
          <span className="edufx-landing-kicker">Model layer</span>
          <h2>Mastery, retrieval, and quiz generation work together.</h2>
          <p>
            The recommendation engine is not a single prompt. It combines deterministic quiz scoring, DKT/BKT
            mastery estimates, retrieved chemistry notes, and a fine-tuned quiz-generation path.
          </p>
        </div>
        <div className="edufx-landing-model-panel">
          <div>
            <Gauge size={22} />
            <strong>DKT + BKT</strong>
            <span>Predicts weak subtopics from previous attempts and focus-aware learning history.</span>
          </div>
          <div>
            <BookOpenCheck size={22} />
            <strong>RAG explanations</strong>
            <span>Grounds answer feedback in curated EduFX chemistry notes before generating explanations.</span>
          </div>
          <div>
            <BarChart3 size={22} />
            <strong>Fine-tuned adapter</strong>
            <span>Trained on EduFX-style question records to keep quiz output aligned with the project domain.</span>
          </div>
        </div>
      </section>

      <section className="edufx-landing-section edufx-landing-section--soft" id="tracking">
        <div className="edufx-landing-section__head">
          <span className="edufx-landing-kicker">Behaviour tracking</span>
          <h2>Focus signals stay local until they become useful learning data.</h2>
          <p>
            Webcam analysis runs in the browser. EduFX stores only derived session signals such as focus score,
            phone alerts, absence, drowsiness, tab switching, and multi-person warnings.
          </p>
        </div>
        <div className="edufx-landing-tracking">
          <article>
            <Activity size={24} />
            <strong>Live focus checks</strong>
            <span>MediaPipe face tracking, object detection, audio activity, and tab integrity are fused during quiz attempts.</span>
          </article>
          <article>
            <CalendarClock size={24} />
            <strong>Session summary</strong>
            <span>Short events are latched into the final summary, so quick phone checks or tab switches are not missed.</span>
          </article>
          <article>
            <CheckCircle2 size={24} />
            <strong>Recommendation context</strong>
            <span>Tracked focus helps the mastery models separate a confident answer from distracted practice.</span>
          </article>
        </div>
      </section>

      <section className="edufx-landing-stack" id="stack">
        <div>
          <span className="edufx-landing-kicker">Production stack</span>
          <h2>Built for the deployed learning loop.</h2>
        </div>
        <div className="edufx-landing-stack__grid">
          {stack.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label}>
                <Icon size={20} />
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="edufx-landing-cta">
        <div>
          <span className="edufx-landing-kicker">Ready for the workspace</span>
          <h2>Continue from login to diagnostic, quiz, progress, and recommendations.</h2>
        </div>
        <a className="edufx-landing-button" href="/login">
          Sign in to EduFX
          <ArrowRight size={17} />
        </a>
      </section>
    </main>
  );
}
