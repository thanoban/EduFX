import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  FlaskConical,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const proof = [
  ["40", "diagnostic checks"],
  ["55", "RAG note chunks"],
  ["0.6822", "DKT ROC-AUC"],
  ["76%", "fine-tune token accuracy"],
];

const steps = [
  { icon: FlaskConical, title: "Diagnose", text: "Start with a short chemistry placement flow." },
  { icon: BrainCircuit, title: "Predict", text: "DKT and BKT estimate the learner's next weak point." },
  { icon: BookOpenCheck, title: "Study", text: "EduFX recommends the next subtopic with grounded support." },
];

export default function HomePage() {
  return (
    <main className="edufx-home">
      <header className="edufx-home-nav">
        <a className="edufx-home-brand" href="/" aria-label="EduFX home">
          <span>Fx</span>
          <strong>EduFX</strong>
        </a>
        <nav aria-label="Landing page sections">
          <a href="#product">Product</a>
          <a href="#intelligence">Intelligence</a>
          <a href="#evidence">Evidence</a>
        </nav>
        <a className="edufx-home-signin" href="/login">Sign in</a>
      </header>

      <section className="edufx-home-hero" id="product">
        <img
          src="/landing/chemistry-lab-hero.jpg"
          alt="Chemistry laboratory glassware with soft daylight"
          className="edufx-home-hero__image"
        />
        <div className="edufx-home-hero__shade" />
        <div className="edufx-home-hero__content">
          <span className="edufx-home-kicker"><Sparkles size={16} /> Adaptive chemistry workspace</span>
          <h1>EduFX helps students study the right chemistry topic next.</h1>
          <p>
            Diagnostic results, mastery models, RAG explanations, and behaviour signals become one clear study route.
          </p>
          <div className="edufx-home-actions">
            <a className="edufx-home-button" href="/login">
              Open workspace <ArrowRight size={17} />
            </a>
            <a className="edufx-home-link" href="#intelligence">See the flow</a>
          </div>
        </div>
        <aside className="edufx-home-hero-card" aria-label="EduFX recommendation summary">
          <span>Next action</span>
          <strong>Revise Group Trends</strong>
          <p>Priority is selected from quiz performance, DKT/BKT mastery, and study timing.</p>
        </aside>
      </section>

      <section className="edufx-home-proof" id="evidence" aria-label="EduFX evidence metrics">
        {proof.map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="edufx-home-section" id="intelligence">
        <div className="edufx-home-section__head">
          <span className="edufx-home-kicker">Student route</span>
          <h2>From assessment to recommendation.</h2>
          <p>No open content browsing. EduFX recommends the next study item from performance evidence.</p>
        </div>
        <div className="edufx-home-steps">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title}>
                <Icon size={24} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="edufx-home-system">
        <div>
          <span className="edufx-home-kicker">Production stack</span>
          <h2>Built around the learning decision.</h2>
        </div>
        <div className="edufx-home-system__grid">
          <span><BarChart3 size={18} /> DKT + BKT mastery tracking</span>
          <span><ShieldCheck size={18} /> Supabase auth and student data</span>
          <span><BookOpenCheck size={18} /> RAG-backed explanations</span>
          <span><CheckCircle2 size={18} /> Fine-tuned quiz generation path</span>
        </div>
      </section>

      <section className="edufx-home-cta">
        <h2>Ready to continue learning?</h2>
        <a className="edufx-home-button" href="/login">
          Go to login <ArrowRight size={17} />
        </a>
      </section>
    </main>
  );
}
