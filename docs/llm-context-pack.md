# EduFX LLM Context Pack

Generated on 2026-09-12 from the project Markdown docs. Use this file as a single context attachment for LLM chats.

> This is an additional consolidated reference. The original docs remain the source files and are not replaced.

## Contents

- `docs\architecture\architecture-reference.md`
- `docs\architecture\code-quality-standard.md`
- `docs\current-status-and-roadmap.md`
- `docs\data\data-format-guide.md`
- `docs\deployment\azure-production.md`
- `docs\deployment\deployment-plan.md`
- `docs\deployment\groq-azure-fallback.md`
- `docs\features\admin-analytics-and-student-management.md`
- `docs\features\authentication-and-session-management.md`
- `docs\features\dashboard-and-adaptive-scheduler.md`
- `docs\features\diagnostic-and-level-assignment.md`
- `docs\features\index.md`
- `docs\features\progress-tracking.md`
- `docs\features\quiz-and-session-flow.md`
- `docs\features\results-and-ai-explanations.md`
- `docs\features\settings-and-availability.md`
- `docs\features\study-content-and-level-aware-notes.md`
- `docs\finetuning\finetune-aws-hosting-guide.md`
- `docs\finetuning\finetune-azure-hosting-guide.md`
- `docs\finetuning\finetune-colab-guide.md`
- `docs\finetuning\finetune-dataset-format.md`
- `docs\finetuning\finetune-method.md`
- `docs\finetuning\finetune-rag-data-plan.md`
- `docs\finetuning\finetune-results.md`
- `docs\finetuning\finetune-vertex-plan.md`
- `docs\getting-started\adaptive-system-learning-guide.md`
- `docs\getting-started\agent-learning-guide.md`
- `docs\getting-started\behaviouraltracking.md`
- `docs\getting-started\session-handoff.md`
- `docs\index.md`
- `docs\ml-recommender\recommender-colab-training.md`
- `docs\ml-recommender\recommender-learning-basics.md`
- `docs\plans\recommender-implementation-plan.md`
- `docs\product\landing-page-plan.md`
- `docs\product\ui-details.md`
- `docs\qa\api-testing-checklist.md`
- `docs\qa\api-testing-guide.md`
- `docs\qa\api-testing\EduFX_API_Test_Summary_2026-08-29.md`
- `docs\qa\automated-api-testing-guide.md`
- `docs\qa\bug-report-samples.md`
- `docs\qa\index.md`
- `docs\qa\manual-testing\exploratory-charter.md`
- `docs\qa\qa-project-structure.md`
- `docs\qa\qa-summary-report.md`
- `docs\qa\test-cases.md`
- `docs\qa\test-plan.md`
- `README.md`

---

## Source: `docs\architecture\architecture-reference.md`

# EduFX Architecture Reference

> Reconciled with the source and Azure production release on 2026-09-10.
> See [Current status and roadmap](../current-status-and-roadmap.md) for live
> URLs, verification results, limitations, and planned work.

## 1. System Purpose

EduFX turns assessment and learning evidence into a constrained next study
action for an A-Level Chemistry student. It combines deterministic product
rules, BKT/DKT knowledge tracing, retrieval, generative AI, and optional
behaviour signals. The LLM does not own authentication, scoring, mastery, or
content access decisions.

## 2. Runtime Architecture

```text
Browser
  -> Azure Container App: Next.js frontend
       -> same-origin /api/backend/* rewrite
            -> Azure Container App: FastAPI backend
                 -> Supabase Auth token verification
                 -> Supabase PostgreSQL repositories
                 -> DKT/BKT/rule recommender
                 -> Groq text generation
                 -> lexical RAG over Supabase chunks
```

Production images are stored in Azure Container Registry. GitHub Actions builds
and deploys both applications when `main` is updated. GCP Cloud Run is retained
only as a manual legacy path.

## 3. Frontend

The frontend uses Next.js 15 App Router, React 19, and TypeScript.

### Main routes

| Route | Responsibility |
|---|---|
| `/` | Public product landing page |
| `/login` | Supabase Google and email/password sign-in |
| `/auth/callback` | Restores the Supabase session and backend student profile |
| `/diagnostic/self-assessment` | Initial confidence input |
| `/diagnostic` | 40-question placement assessment |
| `/diagnostic/results` | Per-subtopic starting levels |
| `/diagnostic/availability` | First-time schedule configuration |
| `/dashboard` | Current adaptive recommendation and daily plan |
| `/study/[id]` | Level-aware content for the active recommendation |
| `/webcam-check` | Optional behaviour-tracking consent/check |
| `/quiz/[id]` | First or personalized quiz |
| `/results/[id]` | Score, explanations, and next actions |
| `/progress` | Learning history and mastery view |
| `/behaviour-logs` | Stored session-level focus summaries |
| `/teacher` | Grounded student coaching |
| `/settings` | Availability, profile, and session controls |
| `/admin` | Admin-only student overview |
| `/admin/[studentId]` | Admin-only student detail |

### API transport

In production, browser calls use `/api/backend/*`. `client/next.config.ts`
rewrites them server-side to the backend URL configured as `BACKEND_ORIGIN`.
This keeps browser traffic same-origin. Local development can use
`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001`.

The API client attaches the stored Supabase bearer token. Route guards wait for
session restoration before rendering protected screens and redirect signed-out
users to `/login`.

## 4. Backend Layers

```text
FastAPI route
  -> controller
  -> service or agent
  -> repository contract
  -> Supabase repository or in-memory repository
```

| Layer | Responsibility | Location |
|---|---|---|
| Route | HTTP method, path, DTO, auth dependency | `server/app/routes/` |
| Controller | Thin request-to-service adapter | `server/app/controllers/` |
| Service | Product rules and use cases | `server/app/services/` |
| Agent | Multi-step orchestration | `server/app/agents/`, scheduling service |
| Repository | Persistence boundary | `server/app/repositories/` |
| Model/DTO | Domain and API data shapes | `server/app/models/` |
| ML | BKT, DKT, candidate scoring | `server/app/ml/` |
| RAG | Ingestion, embedding selection, retrieval | `server/app/rag/` |

`server/app/core/container.py` constructs the active implementations based on
`DATA_BACKEND`. Production uses `supabase`; tests primarily use `memory`.

## 5. Authentication and Authorization

Supabase authenticates the user. The backend independently verifies the access
token using the project JWKS for asymmetric tokens or the configured legacy
HS256 secret.

`server/app/core/request_auth.py` provides two guards:

- `require_authenticated_request`: token must identify a known student in
  Supabase-backed production.
- `require_student_access`: the authenticated student ID must match the student
  path parameter.

Payload-based routes call `assert_student_access` for the same ownership rule.
Admin routes use a separate role check.

Expected behavior:

| Scenario | Result |
|---|---|
| Missing token in Supabase production | `401` |
| Invalid or expired token | `401` |
| Valid token requesting another student | `403` |
| Valid owner token | route-specific success or business-rule error |
| Non-admin token on `/admin/*` | `403` |

The memory backend accepts missing tokens to keep isolated local tests simple.
The current parser also accepts `demo:` tokens; disabling those tokens in
production is a Phase 0 roadmap item.

## 6. API Surface

| Group | Endpoints | Access |
|---|---|---|
| Health | `GET /`, `GET /health/providers` | Public |
| Auth | `POST /auth/google`, `GET /auth/check` | Login or authenticated |
| Diagnostic | `GET /diagnostic/questions`, `POST /diagnostic/submit` | Authenticated owner |
| Scheduler | `GET /scheduler/todays-plan/{student_id}` | Authenticated owner |
| Content | `GET /content/subtopics`, `GET /content/{subtopic_id}/{student_id}` | Authenticated |
| Quiz | `GET /quiz/{subtopic_id}/{student_id}`, `POST /quiz/generate` | Authenticated owner |
| Results | `POST /results/submit-quiz`, `GET /results/session/{session_id}/{student_id}` | Authenticated owner |
| Explanation | `GET /explanation/{session_id}/{student_id}` | Authenticated owner |
| Progress | `GET /progress/{student_id}`, `GET /progress/{student_id}/{subtopic_id}` | Authenticated owner |
| Behaviour | snapshot, summary, session, and student-history routes | Authenticated owner |
| Settings | availability update and next-free check-in | Authenticated owner |
| Teacher | chat and report routes | Authenticated owner |
| Admin | students, student detail, role update | Admin only |

There is no reminder API. `/internal/reminders/run` is deliberately absent and
must return `404`.

## 7. Adaptive Recommendation

The decision is split into two responsibilities.

### RecommenderEngine: what to study

`server/app/ml/recommender_engine.py` ranks all eligible subtopics.

1. Load DKT NumPy weights when available.
2. Otherwise load BKT parameters.
3. Use model scoring when sufficient student history exists.
4. Fall back to deterministic deadline/cooldown priority when a model cannot be
   used.

The DKT artifact has:

- 10 skills
- 22 input values: `2K + focus + tracked`
- 64 hidden units
- recorded synthetic held-out ROC-AUC: `0.6822`

### SchedulingAgent: when and how much

`server/app/services/scheduling_agent.py` applies:

- configured free days
- per-day session length
- next-free check-ins
- weak/strong plan composition
- streak updates after completed sessions

If availability is not configured, the agent uses a three-topic fallback cap.
On a configured non-free day without a check-in promise, it returns no plan.

Content access is recommendation-gated. Students are guided to the active
subtopic rather than choosing arbitrary curriculum content.

## 8. AI Provider Chain

`server/app/services/ai_service.py` separates quiz generation from general text
generation.

```text
Quiz generation:
  optional fine-tuned OpenAI-compatible endpoint
    -> configured provider order
    -> deterministic question fallback where supported

Explanations, teacher, and agent text:
  configured provider order
    -> deterministic route fallback where supported
```

Azure production configures:

```dotenv
AI_PROVIDER_ORDER=groq
VERTEX_AI_ENABLED=false
```

The QLoRA endpoint is attempted only when `FINETUNED_MODEL_URL` exists. Current
production provider health reports that it is not configured.

## 9. Retrieval

Content chunks live in Supabase. `server/app/rag/retriever.py` loads the chunks
for a subtopic and then:

1. obtains a query embedding when Vertex or Gemini embedding access exists;
2. ranks stored vectors in Python with cosine similarity; or
3. uses lexical overlap when no query embedding can be produced.

Current Azure production reports `embedding_provider: lexical`. This is an
intentional Google-free fallback, not a claim that vector retrieval is active.

## 10. Agent Boundaries

| Agent or graph | Inputs | Output |
|---|---|---|
| Scheduling agent | ranked topics, availability, session size | daily plan |
| Teacher graph | deterministic student dossier, question/history | grounded reply |
| Quiz review graph | generated question set and validation result | accepted or regenerated set |

The agents orchestrate existing logic. BKT/DKT remain the mastery models;
repositories remain the source of student facts; services remain responsible
for scoring and authorization-sensitive rules.

## 11. Behaviour Tracking

Browser modules under `client/src/features/webcam/` evaluate face position,
object detections, audio level, frame quality, and integrity signals. The client
sends event snapshots and session summaries to the backend. Raw video is not a
backend input.

The feature is optional. A student can continue without webcam tracking. Focus
data changes the confidence of learning evidence but must not be presented as a
medical diagnosis, identity system, or definitive cheating detector.

## 12. Data

Primary Supabase records include students, subtopics, progress, diagnostic
answers/levels, quiz sessions, question attempts, behaviour events/summaries,
and content chunks. SQL bootstrap material is under `infra/sql/`.

The legacy `email_reminders_enabled` database column may remain for schema
compatibility, but no current UI, API, service, or workflow sends reminders.

## 13. Deployment and CI

### Tests

`.github/workflows/test.yml` runs on pushes to `main` and pull requests:

- Python 3.13 backend `pytest`
- Node 20 frontend TypeScript check
- frontend Vitest suite

### Azure production

`.github/workflows/deploy-azure.yml`:

1. validates GitHub Environment configuration;
2. authenticates through Azure OIDC;
3. builds and pushes backend and frontend images;
4. creates or updates the two Container Apps;
5. injects backend-only secret references;
6. configures the frontend same-origin proxy;
7. updates the backend frontend origin;
8. runs public, protected-route, and removed-route smoke checks.

### Legacy GCP

`.github/workflows/deploy.yml` is `workflow_dispatch` only. It must not be
treated as the normal production pipeline while GCP billing and Vertex are not
part of the active runtime.

## 14. Environment Variables

### Backend production essentials

```dotenv
ENVIRONMENT=production
DATA_BACKEND=supabase
DEMO_MODE=false
SUPABASE_URL=secretref
SUPABASE_KEY=secretref
SUPABASE_SERVICE_ROLE_KEY=secretref
SUPABASE_JWT_SECRET=secretref
GROQ_API_KEY=secretref
GROQ_MODEL=llama-3.3-70b-versatile
AI_PROVIDER_ORDER=groq
VERTEX_AI_ENABLED=false
FRONTEND_ORIGIN=https://edufx-frontend.victorioussand-12db2490.centralindia.azurecontainerapps.io
```

### Frontend build/runtime essentials

```dotenv
NEXT_PUBLIC_API_BASE_URL=/api/backend
NEXT_PUBLIC_SUPABASE_URL=<public project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<public anon or publishable key>
NEXT_PUBLIC_SKIP_LOGIN=false
BACKEND_ORIGIN=https://edufx-backend.victorioussand-12db2490.centralindia.azurecontainerapps.io
```

Never expose the Supabase service-role key, JWT secret, or Groq key through a
`NEXT_PUBLIC_*` variable.

## 15. Known Limitations

- demo tokens must be disabled for external production use;
- broad cloud-domain CORS regexes should be replaced with exact origins;
- deployed authenticated integration tests need a staging Supabase project;
- lexical RAG needs a labelled comparison against hybrid retrieval;
- DKT needs evaluation on real, consented student sequences;
- QLoRA needs a larger dataset and stable serving before production claims;
- scale-to-zero introduces cold-start latency;
- daily reminders are intentionally not implemented.

Prioritized work is tracked in
[Current status and roadmap](../current-status-and-roadmap.md).

---

## Source: `docs\architecture\code-quality-standard.md`

# Code Quality Standard

EduFX should read like a final-year engineering project maintained by a small
senior team: clear boundaries, small functions, and no clever code unless it
removes real complexity.

## Principles

- Keep route handlers thin. They should validate HTTP input, apply auth
  dependencies, and delegate to controllers or services.
- Keep business rules in services, agents, or ML modules, not in React pages or
  FastAPI routes.
- Keep data access behind repository contracts so `memory` and `supabase`
  implementations stay interchangeable.
- Prefer one shared helper over repeated call-site fixes. For example, the
  frontend API client owns bearer-token attachment instead of every screen
  passing tokens manually.
- Treat browser-provided IDs as hints, not authority. The backend must verify
  the bearer token and check student ownership before returning student data.
- Keep generated exports, screenshots, IDE files, logs, and test artifacts out
  of normal Git status.
- Add focused tests for small production contracts that are easy to break, such
  as auth-token forwarding and OAuth callback recovery.

## Frontend Expectations

- Pages should compose feature screens and loading states; feature folders own
  interaction logic.
- Shared API behavior belongs in `client/src/lib/api.ts`.
- Shared browser persistence belongs in `client/src/lib/storage.ts`.
- Loading screens should be calm and useful, with short copy and no blocking
  layout shifts.
- Teacher responses should render as structured UI, not raw Markdown.

## Backend Expectations

- Routes in `server/app/routes/` should stay declarative.
- Controllers should adapt request data to service calls.
- Services should contain product behavior and call repositories.
- Repositories should be the only layer that knows storage details.
- Auth and ownership checks should be applied before service logic reads or
  writes student-owned data.

## Review Checklist

- Can a new reader find the feature entry point in under one minute?
- Is the same logic duplicated in more than one place?
- Does every protected student route verify the token and student ownership?
- Does the frontend send the bearer token without each screen manually passing
  it?
- Are generated files ignored or kept under a deliberate artifact folder?
- Do tests cover the behavior most likely to break in production?

---

## Source: `docs\current-status-and-roadmap.md`

# EduFX Current Status and Roadmap

> Authoritative project status as of 2026-09-11. When another document
> conflicts with this page, use this page and the current source code.

## Production Release

| Item | Current value |
|---|---|
| Production commit | `b3905a07089f4b0546755ad09fff5c1e10c047db` |
| Frontend | `https://edufx-frontend.victorioussand-12db2490.centralindia.azurecontainerapps.io` |
| Backend | `https://edufx-backend.victorioussand-12db2490.centralindia.azurecontainerapps.io` |
| API documentation | `https://edufx-backend.victorioussand-12db2490.centralindia.azurecontainerapps.io/docs` |
| Hosting | Azure Container Apps, Central India |
| Images | Azure Container Registry |
| Database and auth | Supabase PostgreSQL and Supabase Auth |
| Text generation | Groq, configured by `AI_PROVIDER_ORDER=groq` |
| Retrieval | Supabase content chunks with lexical ranking in current Azure production |
| Automatic deployment | Push to `main` through `.github/workflows/deploy-azure.yml` |
| Legacy deployment | GCP Cloud Run workflow is manual-only |

Both Container Apps use `min-replicas=0` and `max-replicas=3`. This reduces
idle cost but means the first request after inactivity can be slower.

## Verified Production Contract

The deployment and independent checks for commit `b3905a0` verified:

| Check | Expected and observed result |
|---|---|
| Frontend `/` | `200` |
| Frontend `/diagnostic/availability` | `200` |
| Backend `/` | `200` |
| Backend `/health/providers` | `200` |
| Anonymous `GET /diagnostic/questions` | `401` |
| Removed `POST /internal/reminders/run` | `404` |
| Reminder route in OpenAPI | absent |
| Text provider order | `groq` |
| Embedding provider | `lexical` |

`401` for an anonymous diagnostic request is correct. Production students must
send their Supabase access token. A valid authenticated request can receive the
questions; a request without a token cannot download assessment content.

The GitHub Actions deployment and both CI jobs completed successfully. The
latest local verification also passed 125 backend tests, 18 frontend tests,
TypeScript checking, and the Next.js production build.

## Working Product Flow

```text
Landing page
  -> Supabase sign-in
  -> self-assessment
  -> 40-question diagnostic
  -> diagnostic results
  -> availability setup
  -> adaptive dashboard
  -> recommended study content
  -> optional webcam check
  -> quiz
  -> results and grounded explanations
  -> progress and behaviour history
  -> recalculated daily plan
```

The student does not browse the curriculum freely. The recommender ranks the
next useful subtopics and the scheduler exposes the active recommendation based
on mastery, spacing, prerequisites, and configured study time.

## System Components

### Authentication and authorization

- Supabase performs Google OAuth and email/password authentication.
- The browser sends the Supabase access token to the FastAPI backend.
- Supabase-backed production routes reject missing or invalid tokens.
- Student-scoped routes compare the token identity with the requested student.
- Admin routes require a student record with the `admin` role.
- The in-memory backend permits token-free calls for isolated local tests.

### Adaptive recommendation

- DKT is loaded first when `server/app/ml/artifacts/dkt.npz` exists.
- BKT is the model fallback when DKT cannot be loaded.
- Deterministic deadline and cooldown rules are the final fallback.
- The DKT artifact uses 10 skills, a 22-value input, and a 64-unit hidden state.
- The recorded held-out synthetic-data DKT ROC-AUC is `0.6822`.
- The scheduler applies daily availability and session-length caps after the
  recommender ranks candidates.

The DKT metric demonstrates predictive signal on simulated students. It is not
evidence of accuracy on a real student population. Real interaction data and a
prospective evaluation are required before making stronger claims.

### AI and retrieval

- Groq handles current production text generation for quizzes, explanations,
  teacher responses, and agent text calls.
- The QLoRA adapter is trained and stored as an artifact, but the current
  production health response reports no configured fine-tuned serving endpoint.
- The retriever reads chemistry chunks from Supabase.
- Without Vertex or a Gemini API key, retrieval uses lexical overlap rather
  than generating a new query embedding.
- Route-specific deterministic fallbacks keep supported flows available when
  a text provider fails.

### Behaviour tracking

- Camera processing runs in the browser.
- Face, object, frame-quality, audio, and integrity signals are summarized.
- Session summaries, not raw video, are sent to the backend.
- Webcam tracking is optional and cannot block studying or quiz submission.

### Agents

- `SchedulingAgent` turns ranked topics into a realistic daily plan.
- The teacher graph builds a deterministic student dossier before generating
  coaching text.
- The quiz-review graph checks generated quiz quality and can request another
  generation attempt.
- Agents orchestrate existing services and models; they do not replace BKT,
  DKT, retrieval, or authorization.

## Deliberately Disabled or Optional Features

### Daily email reminders

Daily email reminders are removed from the UI, API, and GitHub Actions. The
previous workflow could not provide a reliable production feature without a
verified mail provider, consent handling, unsubscribe support, and delivery
monitoring. Availability remains active and continues to control scheduling.

Reintroduce reminders only after those requirements are implemented and tested.

### Fine-tuned model serving

QLoRA training completed successfully, but serving is optional. Quiz generation
uses the fine-tuned endpoint first only when `FINETUNED_MODEL_URL` is configured.
Current Azure production falls through directly to Groq.

### GCP and Vertex

GCP deployment and Vertex support remain in the repository for manual recovery
and historical learning. They are disabled in the Azure production workflow and
must not be described as the active production path.

## Known Risks and Limitations

1. Demo tokens are still recognized by backend token parsing. Before external
   production use, reject `demo:` tokens whenever `ENVIRONMENT=production`.
2. CORS currently accepts all HTTPS `*.run.app` and
   `*.azurecontainerapps.io` origins. Restrict it to the exact production and
   approved preview origins.
3. CI tests use the in-memory backend. A separate authenticated staging suite is
   needed to validate Supabase policies and deployed ownership checks.
4. Scale-to-zero can cause cold-start latency during the first request.
5. Lexical retrieval is robust and inexpensive but weaker than evaluated
   hybrid or embedding retrieval for paraphrased questions.
6. DKT was evaluated on synthetic data. Its `0.6822` ROC-AUC must not be called
   real-world student accuracy.
7. The six-record QLoRA dataset proves the training pipeline, not broad syllabus
   generalization.
8. Behaviour signals are environmental indicators, not medical, identity, or
   cheating determinations.

## Delivery Plan

### Phase 0: production security

- Disable demo-token authentication in production.
- Replace broad cloud-host CORS regexes with an explicit allowlist.
- Add deployed tests for missing token `401`, cross-student `403`, admin `403`,
  and valid Supabase token success.
- Confirm secrets exist only in GitHub Environment secrets and Azure Container
  App secret references; rotate any value exposed outside those stores.

### Phase 1: reliability and observability

- Add structured request IDs and provider latency/error metrics.
- Track Azure cold starts and decide whether a minimum backend replica is worth
  the additional cost before demonstrations.
- Add bounded retry/circuit-breaker behavior around Groq and Supabase calls.
- Add a staging environment so destructive QA never writes production data.

### Phase 2: retrieval and AI quality

- Build a labelled retrieval evaluation set from real S-block questions.
- Compare lexical, BM25, embedding, and hybrid ranking using recall at k.
- Add schema-constrained quiz generation and record review-agent rejection rate.
- Expand the QLoRA dataset to at least 50-100 reviewed examples, run held-out
  quality tests, and only then decide whether GPU serving is justified.

### Phase 3: recommender validation

- Collect consented, de-identified interaction sequences.
- Compare DKT, BKT, and deterministic ranking on the same temporal split.
- Measure ROC-AUC, calibration, coverage, repeated-topic rate, and learning gain.
- Keep BKT and deterministic rules as explainable fallbacks.

### Phase 4: product completeness

- Run mobile, keyboard, screen-reader, and slow-network journeys.
- Add positive admin integration tests and complete settings/teacher API tests.
- Reconsider email or calendar notifications only with explicit opt-in, provider
  monitoring, unsubscribe controls, and privacy documentation.

## Release Rules

A production change is complete only when:

1. backend tests, frontend tests, and TypeScript checking pass;
2. the production frontend build passes;
3. the Azure deployment workflow succeeds for the intended commit;
4. public health routes return `200`;
5. protected anonymous routes return `401`;
6. authenticated ownership tests return `200` for the owner and `403` for a
   different student;
7. no retired endpoint is present in OpenAPI;
8. live provider health matches the intended production provider configuration.

---

## Source: `docs\data\data-format-guide.md`

# EduFX — Data Format Guide
> How to prepare your chemistry notes for RAG and Fine-tuning

---

## The Simple Answer Up Front

You **do not** need to split your notes by beginner / intermediate / advanced.
You **do not** need to label difficulty levels in your training data.

Just write your notes per topic — one set per subtopic — and the system handles the rest.

---

## Overview

| Purpose | What you make | Where it goes |
|---|---|---|
| **RAG** | One text block per topic -> CSV | Supabase `content_chunks` table through the ingest script |
| **Fine-tuning** | JSONL with instruction/output pairs | Google Colab for training |

---

## Part 1 — RAG: Formatting Your Notes

### The rule: one row per subtopic

The `content` table needs:

| column | what goes here |
|---|---|
| `subtopic_id` | integer ID matching the `subtopics` table |
| `level` | just put `"all"` — or omit it, see note below |
| `body` | your full notes for that topic as plain text |

> **Why no level split?**
> The ingest script chunks your notes into ~250-word pieces and embeds them as vectors.
> At query time, RAG retrieves the most *relevant* chunks regardless of level label.
> The relevance comes from the content of your writing, not from a category tag.
> One good set of notes per topic is enough.

So for **Group 1 Reactions** you only need **1 row**, not 3:

```
subtopic_id=2 | body="Group 1 reactivity increases down the group because the outer
electron is further from the nucleus and is shielded by more inner shells..."
```

---

### What your notes should look like

Write them as **flowing paragraphs** covering the topic fully — from basics through to exam-level detail. Include everything in one body:

```
Group 1 elements are the alkali metals: Li, Na, K, Rb, Cs, Fr. They each have
one electron in their outer shell, making them highly reactive.

Reactivity increases down the group. This is because the outer electron is
progressively further from the nucleus and more shielded by inner shells, so
less energy (lower ionisation energy) is needed to remove it.

Reaction with water:
2Na(s) + 2H2O(l) → 2NaOH(aq) + H2(g)
The product is an alkaline solution (pH > 7) and hydrogen gas is released.
Lithium fizzes gently, sodium moves rapidly and may ignite, potassium burns
with a lilac flame, and caesium reacts explosively.

Anomaly: lithium has a more negative standard electrode potential (E° = -3.04V)
than caesium (-3.03V), yet caesium is more reactive in water. This is because
water reactivity depends on ionisation energy (dominant factor), hydration
enthalpy, and melting point — not electrode potential alone.
```

Cover simple facts, trends with reasons, equations with explanations, and any exam-level anomalies — all in one block. The chunker will split it; RAG will retrieve only what is relevant to each query.

---

### What NOT to do in your notes

| ❌ Avoid | ✅ Do instead |
|---|---|
| Only bullet points | Flowing paragraphs — bullets break chunking |
| Very short notes (under 150 words) | Write at least 200–400 words per topic |
| Equations with no explanation | Always say what the equation means |
| Copying textbook word for word | Paraphrase — the model learns your style |
| Separate files for each level | One file, all depth levels in one body |

---

### CSV format to load into Supabase

Save as `data/notes/s_block_notes.csv`:

```csv
subtopic_id,body
1,"Group 1 elements are the alkali metals Li Na K Rb Cs Fr. They each have one electron in their outer shell making them highly reactive. Reactivity increases down the group because..."
2,"Group 1 reactivity increases down the group because the outer electron is further from the nucleus and is shielded by more inner shells. Reaction with water: 2Na + 2H2O → 2NaOH + H2..."
3,"The thermal stability of Group 1 carbonates and nitrates increases down the group. This is because larger cations with lower charge density polarise the anion less..."
```

**Tips:**
- Wrap every body in double quotes `"..."`
- If your notes contain a `"`, write it as `""` (two quotes)
- Keep each row on one line — no actual line breaks inside a cell
- Save as UTF-8

Ingest via the project CLI:

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
python -m app.rag.ingest
```

The ingest script then:
1. Reads every row from `data/notes/*.csv`
2. Splits body into ~250-word chunks with 30-word overlap
3. Embeds each chunk with Vertex AI `gemini-embedding-001` (384-dim vector)
4. Stores in `content_chunks` for similarity search

---

### Your subtopics and their IDs

Check the IDs before filling the CSV:

```sql
SELECT id, group_name, title FROM subtopics ORDER BY id;
```

Seeded list (from `server/app/core/store.py`):

```
id=1   group1   Group Trends
id=2   group1   Reactions of Group 1 Elements
id=3   group1   Thermal Stability of Salts
id=4   group1   Solubility of Group 1 Salts
id=5   group1   Flame Test
id=6   group2   Group Trends
id=7   group2   Reactions of Group 2 Elements
id=8   group2   Thermal Stability of Salts
id=9   group2   Solubility of Group 2 Salts
id=10  group2   Flame Test
```

Add P-block and D-block subtopics to the `subtopics` table first, then get their IDs.

---

## Part 2 — Fine-tuning: Training Data Format

### No level or difficulty categories needed

Fine-tuning teaches the model **how to write a good A-Level chemistry MCQ in the right JSON format**. It does not need to know about beginner/intermediate/advanced to learn that.

Your instruction is simply: topic name + notes → generate questions.
The model learns the format. The difficulty column in the output JSON is still included, but it can be a mix — the model will learn to generate a natural spread.

---

### The file format

One JSON object per line — called **JSONL** (JSON Lines).
Save as `data/finetune/training_data.jsonl`.

Every line has exactly two keys:
```
{"instruction": "...the prompt...", "output": "...the answer..."}
```

No wrapping array. No trailing commas. One JSON object per line, nothing else.

---

### Task A — Quiz generation examples

**Template (no level needed):**
```
instruction = "You are an A-Level Chemistry examiner. Topic: {subtopic_title}. Group: {group_name}.\n\nNotes:\n{your notes body}\n\nGenerate 5 multiple-choice A-Level chemistry questions as a JSON array. Each object must have: question_text, option_a, option_b, option_c, option_d, correct_answer (A/B/C/D), difficulty (easy/medium/hard)."

output = "[...5 questions as JSON array...]"
```

**Real example line:**
```jsonl
{"instruction": "You are an A-Level Chemistry examiner. Topic: Reactions of Group 1 Elements. Group: group1.\n\nNotes:\nGroup 1 reactivity increases down the group because the outer electron is further from the nucleus and is shielded by more inner shells. This means less energy is needed to remove it.\n\nReaction with water: 2Na(s) + 2H2O(l) → 2NaOH(aq) + H2(g). The metal dissolves forming an alkaline solution and releasing hydrogen gas. Caesium reacts explosively because it has the lowest first ionisation energy.\n\nGenerate 5 multiple-choice A-Level chemistry questions as a JSON array. Each object must have: question_text, option_a, option_b, option_c, option_d, correct_answer (A/B/C/D), difficulty (easy/medium/hard).", "output": "[{\"question_text\": \"Why does potassium react more vigorously with water than sodium?\", \"option_a\": \"Potassium has a higher melting point\", \"option_b\": \"Potassium has a lower first ionisation energy\", \"option_c\": \"Potassium has fewer electrons\", \"option_d\": \"Potassium has a higher nuclear charge\", \"correct_answer\": \"B\", \"difficulty\": \"medium\"}, {\"question_text\": \"What gas is released when sodium reacts with water?\", \"option_a\": \"Oxygen\", \"option_b\": \"Carbon dioxide\", \"option_c\": \"Hydrogen\", \"option_d\": \"Nitrogen\", \"correct_answer\": \"C\", \"difficulty\": \"easy\"}, {\"question_text\": \"What is the pH of the solution formed when lithium reacts with water?\", \"option_a\": \"Below 7\", \"option_b\": \"Exactly 7\", \"option_c\": \"Above 7\", \"option_d\": \"Cannot be determined\", \"correct_answer\": \"C\", \"difficulty\": \"easy\"}, {\"question_text\": \"Which Group 1 metal reacts most vigorously with water?\", \"option_a\": \"Lithium\", \"option_b\": \"Sodium\", \"option_c\": \"Potassium\", \"option_d\": \"Caesium\", \"correct_answer\": \"D\", \"difficulty\": \"medium\"}, {\"question_text\": \"What is the role of the Group 1 metal in its reaction with water?\", \"option_a\": \"Oxidising agent\", \"option_b\": \"Reducing agent\", \"option_c\": \"Catalyst\", \"option_d\": \"Spectator ion\", \"correct_answer\": \"B\", \"difficulty\": \"hard\"}]"}
```

**How many do you need?**
- Aim for **4–5 lines per subtopic**
- 10 subtopics × 4 examples = **~40–50 Task A lines**
- That is enough for the model to learn the format

**Where does the output come from?**
Two options:
1. Write the questions yourself (best quality, catches errors)
2. Generate with Vertex AI Gemini, review each question, then use as output

---

### Task B — Explanation examples

The model learns how to explain a wrong answer in plain English.
No level category needed here either — just include the question context.

**Template:**
```
instruction = "You are an A-Level Chemistry teacher.\n\nQuestion: {question_text}\nOption A: {option_a}\nOption B: {option_b}\nOption C: {option_c}\nOption D: {option_d}\nStudent answered: {student_answer}\nCorrect answer: {correct_answer}\n\nExplain in 2-3 sentences why the correct answer is right and why the student answer is wrong. Plain text only."

output = "...2-3 sentence plain text explanation..."
```

**Real example line:**
```jsonl
{"instruction": "You are an A-Level Chemistry teacher.\n\nQuestion: Why does potassium react more vigorously with water than sodium?\nOption A: Potassium has a higher melting point\nOption B: Potassium has a lower first ionisation energy\nOption C: Potassium has fewer electrons\nOption D: Potassium has a higher nuclear charge\nStudent answered: A\nCorrect answer: B\n\nExplain in 2-3 sentences why the correct answer is right and why the student answer is wrong. Plain text only.", "output": "The correct answer is B because potassium's outer electron is in a higher energy shell, further from the nucleus and more shielded, so less energy is needed to remove it. This lower ionisation energy means potassium loses its electron more easily than sodium and reacts faster with water. Melting point has no significant effect on reactivity with water in Group 1."}
```

**Where does the output come from?**
- Pull from Supabase `quiz_attempts` table — the `explanation` column already has AI-generated explanations from prior sessions
- Use the export script below

**How many do you need?**
- Aim for **50–80 Task B lines**
- **Total JSONL target: ~100–130 lines** (50 Task A + 80 Task B)

---

### Export script — pull Task B from Supabase automatically

Save as `server/notebooks/export_training_data.py`:

```python
import json
from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv()
db = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

rows = (
    db.table("quiz_attempts")
    .select("*, questions(*)")
    .eq("is_correct", False)
    .not_.is_("explanation", "null")
    .execute()
    .data
)

lines = []
for row in rows:
    q = row["questions"]
    instruction = (
        "You are an A-Level Chemistry teacher.\n\n"
        f"Question: {q['question_text']}\n"
        f"Option A: {q['option_a']}\nOption B: {q['option_b']}\n"
        f"Option C: {q['option_c']}\nOption D: {q['option_d']}\n"
        f"Student answered: {row['student_answer']}\n"
        f"Correct answer: {row['correct_answer']}\n\n"
        "Explain in 2-3 sentences why the correct answer is right and why "
        "the student answer is wrong. Plain text only."
    )
    lines.append({"instruction": instruction, "output": row["explanation"]})

with open("data/finetune/task_b_explanations.jsonl", "w") as f:
    for line in lines:
        f.write(json.dumps(line) + "\n")

print(f"Exported {len(lines)} Task B examples")
```

---

## Part 3 — Folder Structure

```
EduFX_MVC/
├── data/
│   ├── notes/
│   │   ├── s_block_notes.csv          ← one row per subtopic (no level split)
│   │   ├── p_block_notes.csv          ← add when ready
│   │   └── d_block_notes.csv          ← add when ready
│   └── finetune/
│       ├── training_data.jsonl        ← final merged file → upload to Colab
│       ├── task_a_quiz_gen.jsonl      ← quiz generation examples
│       └── task_b_explanations.jsonl  ← explanation examples
└── server/
    └── notebooks/
        ├── export_training_data.py    ← pulls Task B from Supabase
        └── finetune_gemma2.ipynb      ← Colab training notebook
```

---

## Part 4 — Quick Checklist

### RAG notes (notes CSV)

- [ ] One row per subtopic — no level split needed
- [ ] Each body is at least 200 words (more = better retrieval)
- [ ] Notes are written in flowing paragraphs, not just bullet points
- [ ] Equations are included with explanations
- [ ] `subtopic_id` values match actual IDs in the `subtopics` table
- [ ] File saved as UTF-8 CSV

### Fine-tuning data (JSONL)

- [ ] Each line is valid JSON — test with:
  `python -c "import json; [json.loads(l) for l in open('training_data.jsonl')]"`
- [ ] Every line has both `instruction` and `output` keys
- [ ] No level or difficulty category required in the instruction
- [ ] Task A outputs are valid JSON arrays of 5 questions
- [ ] Task B outputs are plain text, 2–3 sentences, no bullet points
- [ ] At least 100 total lines (target 130, cap at 500)
- [ ] No duplicate lines

---

## Part 5 — How It Flows at Runtime

```
Student requests a quiz on "Reactions of Group 1 Elements"
                │
                ▼
RAG retriever searches content_chunks using vector similarity
                │
                ▼
Top 5 most relevant chunks retrieved from YOUR notes
                │
                ▼
Chunks added to the AI prompt as context
                │
                ▼
Fine-tuned model (Gemma 2B) or Vertex AI (Gemini)
generates 15 questions grounded in your actual notes
                │
                ▼
Student gets a chemistry quiz built from what they studied
```

**The quality of your notes = the quality of the quiz.**
Generic notes → generic questions. Detailed notes with real equations and reasoning → precise, exam-relevant questions.

---

## Source: `docs\deployment\azure-production.md`

# Azure Production Deployment

This guide is the primary production deployment path for EduFX. Azure Container
Apps hosts the backend and frontend, Azure Container Registry stores the images,
Supabase provides the database and auth, and the AI provider chain runs with
Vertex disabled so the app does not depend on GCP billing.

## Production Shape

EduFX now uses a configurable text-provider chain:

```text
Fine-tuned quiz endpoint (quiz generation only, when configured)
  -> Groq
  -> deterministic application fallback
```

The order after the fine-tuned endpoint comes from `AI_PROVIDER_ORDER`. The
Azure workflow sets `groq` and `VERTEX_AI_ENABLED=false`, so no Vertex or
Gemini request is attempted in Azure production. If Groq is unavailable,
route-specific deterministic fallbacks keep the API available where supported.

The relevant implementation files are:

- `server/app/services/ai_service.py`: provider selection and fallback
- `server/app/core/config.py`: provider settings
- `server/app/core/clients.py`: enables AI features in Groq-only deployments
- `server/app/rag/embedder.py`: independent embedding-provider selection
- `.github/workflows/deploy-azure.yml`: Azure deployment
- `.github/workflows/deploy.yml`: manual legacy GCP deployment

## Important: Generation and Embeddings Are Different

Groq is used for text generation, including the AI teacher, explanations, and
the general quiz fallback. Groq does not create the `gemini-embedding-001`
vectors originally used by EduFX RAG.

For Azure production, EduFX does not require a Google embedding key. The
retriever still reads stored chemistry chunks from Supabase; when no embedding
provider is configured, it ranks those chunks with lexical term overlap. This
keeps RAG-backed explanations usable without creating another paid Azure OpenAI
or Google AI resource.

| Configuration | Text generation | RAG embeddings |
|---|---|---|
| Azure production | Groq | Lexical fallback over Supabase chunks |
| Groq + optional Gemini API key | Groq | Gemini vector query |
| Vertex enabled manually | Configurable | Vertex first, Gemini API-key fallback |

Do not switch to another embedding model unless all stored content chunks are
re-embedded with the same model and dimensions.

## 1. Create the Groq Production Key

1. Sign in at `https://console.groq.com`.
2. Open **API Keys** and create a key for EduFX production.
3. Copy it once and store it as the GitHub secret `GROQ_API_KEY`.
4. Never place it in the frontend, a `NEXT_PUBLIC_*` variable, source control,
   screenshots, or documentation.
5. Check the Groq model and rate-limit pages before a production demonstration.

The default model is `llama-3.3-70b-versatile`. It can be changed without a
code edit by setting the GitHub variable `GROQ_MODEL` to a currently supported
production model.

Azure production requires `GROQ_API_KEY`. Keep it in GitHub Environment secrets
or Azure Container App secrets only; never commit it, expose it to the browser,
or place it in generated reports.

## 2. Local Groq-First Configuration

Copy the server environment example to the repository root `.env`, then use:

```dotenv
DATA_BACKEND=supabase
DEMO_MODE=false

GROQ_API_KEY=gsk_replace_with_your_key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TIMEOUT_SECONDS=45
AI_PROVIDER_ORDER=groq

VERTEX_AI_ENABLED=false
GOOGLE_CLOUD_PROJECT=

# Optional only. Leave empty for Google-free Azure production.
GEMINI_API_KEY=
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=384
```

Start the backend and inspect the non-sensitive provider status:

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
uvicorn app.main:app --reload --port 8001
Invoke-RestMethod http://localhost:8001/health/providers
```

Expected Groq-first result:

```json
{
  "text_provider_order": ["groq"],
  "groq_configured": true,
  "gemini_configured": false,
  "vertex_enabled": false,
  "finetuned_endpoint_configured": false,
  "embedding_provider": "lexical"
}
```

`embedding_provider` becomes `gemini` only if `GEMINI_API_KEY` is configured.
No endpoint response contains secret values.

## 3. Azure Resources

The workflow deploys two Linux containers to Azure Container Apps and builds
their images in Azure Container Registry. It runs automatically for pushes to
`main`, can also be started manually, and scales both apps to zero when idle.

Install Azure CLI, sign in, and create the base resources once:

```powershell
az login
az account set --subscription "<subscription-id>"

$location = "centralindia"
$resourceGroup = "edufx-production"
$acr = "edufxacr901ad003"
$environment = "edufx-environment"

az group create --name $resourceGroup --location $location
az acr create --name $acr --resource-group $resourceGroup --sku Basic
az extension add --name containerapp --upgrade --yes
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.ContainerRegistry
az containerapp env create `
  --name $environment `
  --resource-group $resourceGroup `
  --location $location `
  --logs-destination none
```

Azure Container Registry names must be globally unique and contain only
letters and numbers.

## 4. GitHub OIDC Authentication

Use OpenID Connect instead of storing an Azure client secret. Create an Entra
application and service principal:

```powershell
$appName = "edufx-github-deploy"
$appId = az ad app create --display-name $appName --query appId -o tsv
$spObjectId = az ad sp create --id $appId --query id -o tsv
$subscriptionId = az account show --query id -o tsv
$tenantId = az account show --query tenantId -o tsv
$resourceGroupId = az group show --name $resourceGroup --query id -o tsv
$acrId = az acr show --name $acr --resource-group $resourceGroup --query id -o tsv

az role assignment create `
  --assignee-object-id $spObjectId `
  --assignee-principal-type ServicePrincipal `
  --role Contributor `
  --scope $resourceGroupId

az role assignment create `
  --assignee-object-id $spObjectId `
  --assignee-principal-type ServicePrincipal `
  --role AcrPush `
  --scope $acrId

# Required because the workflow grants each Container App identity AcrPull.
az role assignment create `
  --assignee-object-id $spObjectId `
  --assignee-principal-type ServicePrincipal `
  --role "User Access Administrator" `
  --scope $acrId
```

Create `azure-federated-credential.json` locally:

```json
{
  "name": "edufx-github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:thanoban/EduFX:environment:azure-production",
  "description": "EduFX Azure production deployment",
  "audiences": ["api://AzureADTokenExchange"]
}
```

Register it, then delete the local JSON file:

```powershell
az ad app federated-credential create `
  --id $appId `
  --parameters azure-federated-credential.json
Remove-Item -LiteralPath .\azure-federated-credential.json
```

The subject must exactly match the GitHub repository and Environment name.

## 5. GitHub Environment Configuration

In GitHub, open **Settings -> Environments**, create
`azure-production`, then add the following Environment secrets.

### Required secrets

| Secret | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | `$appId` from the OIDC setup |
| `AZURE_TENANT_ID` | `$tenantId` |
| `AZURE_SUBSCRIPTION_ID` | `$subscriptionId` |
| `SUPABASE_URL` | Backend and frontend Supabase project URL |
| `SUPABASE_KEY` | Backend key only |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend service-role key only |
| `SUPABASE_JWT_SECRET` | Backend JWT verification secret |
| `SUPABASE_ANON_KEY` | Public anon/publishable key for the frontend |

`SUPABASE_ANON_KEY` is the only Supabase key compiled into the browser. Never
use an `sb_secret_...` or service-role value for it.

Azure production requires `GROQ_API_KEY`. Gemini and Vertex are intentionally
not injected by the Azure workflow because the current production goal is to
avoid Google AI runtime and GCP billing dependency.

### Optional secrets

| Secret | Purpose |
|---|---|
| `GROQ_API_KEY` | Required Groq production text-generation key |
| `GEMINI_API_KEY` | Optional local/manual vector embedding fallback; not used by Azure workflow |
| `FINETUNED_MODEL_URL` | External OpenAI-compatible QLoRA model endpoint |

Daily reminder automation is disabled because a production mail provider is
not configured. Availability still drives the adaptive scheduler.

Add these Environment variables, which are non-sensitive:

| Variable | Example |
|---|---|
| `AZURE_RESOURCE_GROUP` | `edufx-production` |
| `AZURE_CONTAINER_REGISTRY` | `edufxacr901ad003` |
| `AZURE_CONTAINERAPPS_ENVIRONMENT` | `edufx-environment` |
| `AZURE_BACKEND_APP` | `edufx-backend` |
| `AZURE_FRONTEND_APP` | `edufx-frontend` |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |

## 6. Deploy to Azure

1. Open the repository's **Actions** tab.
2. Select **Deploy Azure production**.
3. Select **Run workflow** on the intended branch.
4. Wait for the backend image, backend app, frontend image, and frontend app
   steps to finish.
5. Read the backend and frontend URLs from the final smoke-test log.

The workflow:

1. authenticates to Azure through GitHub OIDC;
2. builds both images in ACR;
3. creates or updates both Container Apps;
4. stores backend credentials as Container Apps secrets;
5. assigns managed identities for private ACR image pulls;
6. disables Vertex and selects Groq as the Azure text provider;
7. sets the frontend URL as the backend CORS origin;
8. checks `/`, `/health/providers`, and the frontend home page.

## 7. Production Verification

Run these after deployment:

```powershell
$backend = "https://<backend-app>.<region>.azurecontainerapps.io"
$frontend = "https://<frontend-app>.<region>.azurecontainerapps.io"

Invoke-RestMethod "$backend/"
Invoke-RestMethod "$backend/health/providers"
Start-Process "$backend/docs"
Start-Process $frontend
```

Then verify authenticated product paths:

- sign in through the Azure frontend;
- ask the AI teacher a question and confirm a response;
- generate a quiz and submit it;
- request a wrong-answer explanation;
- confirm explanations still include retrieved or lexical-ranked Supabase context;
- inspect Container App logs for provider fallback warnings.

Useful log command:

```powershell
az containerapp logs show `
  --name <backend-app> `
  --resource-group <resource-group> `
  --follow
```

## 8. Failover Behaviour

| Failure | Result |
|---|---|
| Vertex blocked | Skipped when `VERTEX_AI_ENABLED=false` |
| Groq unavailable or rate-limited | Service returns its existing deterministic fallback where supported |
| Fine-tuned endpoint offline | Quiz generation continues through the configured provider order |
| No embedding provider | Retriever uses lexical ranking over stored Supabase chunks |
| Azure cold start | First request can be slower because minimum replicas is zero |

## 9. Cost and Rollback

- Azure is the only automatic production deployment; GCP remains manual-only.
- Both Container Apps use `min-replicas=0` and `max-replicas=3`.
- ACR image storage, logs, outbound traffic, Supabase, and Groq API calls can
  still incur cost.
- Set budget alerts in Azure Cost Management and Groq usage limits before a
  demonstration.
- Stop using Azure by disabling ingress or deleting the two Container Apps.
  Delete the resource group only when every resource inside it is disposable.
- To restore Vertex generation, set `VERTEX_AI_ENABLED=true`, provide
  `GOOGLE_CLOUD_PROJECT`, and put `vertex` first in `AI_PROVIDER_ORDER`.

## 10. Troubleshooting

### AI features appear disabled

Call `/health/providers`. `groq_configured` must be `true`. The backend now
enables AI features when Groq, Gemini, Vertex, or the fine-tuned endpoint is
configured; a GCP project is no longer required.

### Groq returns 401

Replace the `GROQ_API_KEY` Environment secret and rerun the workflow. Do not
print the key in Actions logs.

### Groq returns 429

Check account rate limits, reduce simultaneous requests, or temporarily switch
to another configured provider in `AI_PROVIDER_ORDER`.

### RAG answers have no retrieved context

Confirm `content_chunks` exist in Supabase for the requested subtopic. In
Google-free Azure production, `/health/providers` should report
`embedding_provider: lexical`, meaning the backend ranks stored chunks without a
new vector query.

### Azure cannot pull an ACR image

Confirm the Container App has a system-assigned identity, that identity has
`AcrPull` on the registry, and the GitHub OIDC principal can create that role
assignment.

### Browser reports a CORS error

Confirm `FRONTEND_ORIGIN` matches the exact Azure frontend URL. EduFX also
allows HTTPS `*.azurecontainerapps.io` origins for Azure deployments.

---

## Source: `docs\deployment\deployment-plan.md`

# EduFX Deployment Plan

> Historical/manual GCP recovery plan. Current automatic production uses Azure
> Container Apps and GitHub Actions; see [Azure production deployment](azure-production.md)
> and [Current status and roadmap](../current-status-and-roadmap.md).

> Azure Container Apps is the current automatic production path. For
> Groq-first generation with Vertex disabled, Supabase authentication, and
> GitHub Actions deployment, follow
> [Groq AI and Azure deployment fallback](groq-azure-fallback.md).

This file preserves the legacy GCP deployment and fine-tuned-model notes for
manual recovery. It is not triggered automatically while GCP billing is
unavailable.

GCP project: `responsive-sun-491204-e0` · Region: `asia-northeast1` (Tokyo, closest to Supabase `ap-northeast-1`).

## Architecture Overview

```
                    GitHub push to main
                            │
                  GitHub Actions (deploy.yml)
                   │                    │
         build & push images    build & push images
                   │                    │
                   ▼                    ▼
         Cloud Run: backend     Cloud Run: frontend
         (FastAPI :8080)        (Next.js :3000)
                   │                    │
                   ├── Supabase (PostgreSQL + pgvector)
                   ├── Vertex AI (Gemini 2.5 Flash + embeddings)
                   └── Fine-tuned Qwen (vLLM on GCE GPU VM) ── optional
```

Three deployable units: **backend** (FastAPI), **frontend** (Next.js), and the **fine-tuned model** (vLLM, optional — the app falls back to Gemini if it is not running).

---

## Part 1 — One-Time GCP Setup

Run these once in Cloud Shell or a local terminal with `gcloud` authenticated. They create the registry, the runtime service account, and the deploy service account that GitHub Actions uses.

```bash
PROJECT=responsive-sun-491204-e0
REGION=asia-northeast1

# 1. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  compute.googleapis.com \
  --project=$PROJECT

# 2. Create Artifact Registry repo for Docker images
gcloud artifacts repositories create edufx \
  --repository-format=docker \
  --location=$REGION \
  --project=$PROJECT

# 3. Runtime service account — what Cloud Run runs AS (needs Vertex AI)
gcloud iam service-accounts create edufx-runtime \
  --display-name="EduFX Cloud Run Runtime" \
  --project=$PROJECT

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:edufx-runtime@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# 4. Deploy service account — what GitHub Actions uses
gcloud iam service-accounts create edufx-deploy \
  --display-name="EduFX GitHub Deploy" \
  --project=$PROJECT

for ROLE in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:edufx-deploy@$PROJECT.iam.gserviceaccount.com" \
    --role=$ROLE
done

# 5. Generate the JSON key for GitHub Actions
gcloud iam service-accounts keys create edufx-deploy-key.json \
  --iam-account=edufx-deploy@$PROJECT.iam.gserviceaccount.com
```

> **After adding the key to GitHub (Part 2), delete `edufx-deploy-key.json` from your machine.** It is a long-lived credential.

---

## Part 2 — GitHub Actions Secrets

Add these in the repo: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Value | Where it comes from |
|--------|-------|---------------------|
| `GCP_PROJECT_ID` | `responsive-sun-491204-e0` | GCP project ID |
| `GCP_SA_KEY` | full JSON contents of `edufx-deploy-key.json` | Part 1, step 5 |
| `SUPABASE_URL` | `https://marvtabsezuiwfqhcwcb.supabase.co` | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | **PUBLIC** key baked into the browser bundle — the legacy `anon` JWT (`eyJ…`) or the new `sb_publishable_…` key. Never an `sb_secret_…` key. | Supabase → Project Settings → API → Project API keys → `anon`/`publishable` |
| `SUPABASE_KEY` | backend-only key (may be the `sb_secret_…`/service key); used server-side, never sent to the browser | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role/secret key used only by the backend | Supabase → Project Settings → API |
| `SUPABASE_JWT_SECRET` | JWT secret | Supabase → Project Settings → API → JWT Settings |
| `BACKEND_URL` | optional deployed backend Cloud Run URL override, e.g. `https://edufx-backend-xxxxx-an.a.run.app` | first successful backend deploy output |
| `FRONTEND_URL` | (blank initially, fill after first deploy) | Cloud Run frontend URL |
| `FINETUNED_MODEL_URL` | optional, e.g. `http://<vm-ip>:8080` | vLLM VM URL, only when the GPU model server is running |

These map directly into the Cloud Run service env vars in `.github/workflows/deploy.yml`. Nothing secret lives in the repo — `.env` stays gitignored.

## Part 3 — Backend Deployment (FastAPI)

**Image:** `server/Dockerfile` — Python 3.12 slim, installs `requirements.txt`, runs `uvicorn app.main:app` on `$PORT` (Cloud Run injects `8080`).

**Runtime env vars** (set by the workflow, not committed):

```
DATA_BACKEND=supabase
DEMO_MODE=false
SUPABASE_URL / SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET
GOOGLE_CLOUD_PROJECT=responsive-sun-491204-e0
GOOGLE_CLOUD_LOCATION=global
VERTEX_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=384
FINETUNED_MODEL_URL=<optional vLLM URL>
FINETUNED_MODEL_NAME=edufx
FRONTEND_ORIGIN=<frontend Cloud Run URL>   # locks CORS
```

**Vertex AI auth in production:** no key file needed. Cloud Run runs as `edufx-runtime` which has `roles/aiplatform.user`, so the `google-genai` SDK picks up credentials automatically via Application Default Credentials.

**Service config:** `--allow-unauthenticated`, `--min-instances=0` (scales to zero when idle = free), `--max-instances=3`, `512Mi` memory, `1` CPU.

---

## Part 4 — Frontend Deployment (Next.js)

**Image:** `client/Dockerfile` — multi-stage build. `next.config.ts` has `output: "standalone"`, so the runner stage only copies the standalone server + static assets (small image, fast cold start).

**Build-time args** (baked at image build because `NEXT_PUBLIC_*` vars are compiled into the bundle):

```
NEXT_PUBLIC_API_BASE_URL      = backend Cloud Run URL
NEXT_PUBLIC_SUPABASE_URL      = Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY = GitHub secret `SUPABASE_ANON_KEY` only; never use `SUPABASE_SERVICE_ROLE_KEY` or any `sb_secret_...` value here
```

The workflow passes the backend's deployed URL into the frontend build automatically (`needs.deploy-backend.outputs.url`), so the order is: **backend deploys first → its URL feeds the frontend build → frontend deploys**.

---

## Part 5 — First Deploy Sequence

1. Complete Part 1 (GCP setup) and Part 2 (all secrets except `FRONTEND_URL`).
2. Push to `main` — GitHub Actions runs `deploy.yml` automatically.
3. Backend builds and deploys → frontend builds (using backend URL) and deploys.
4. Copy the **backend URL** and **frontend URL** from the Actions log.
5. Optionally add the backend URL as the `BACKEND_URL` secret or repository variable for manual integrations.
6. Add the frontend URL as the `FRONTEND_URL` secret.
7. Re-run the workflow (or push again) so the backend picks up `FRONTEND_ORIGIN` and locks CORS to the real frontend.
8. Visit the frontend URL — the app is live.

The legacy workflow is kept at `.github/workflows/deploy.yml` for manual recovery only. Azure production is deployed by `.github/workflows/deploy-azure.yml` on pushes to `main` or manual `workflow_dispatch`.

---

## Part 6 — Fine-Tuned Model Deployment (Optional)

The fine-tuned Qwen2.5-7B adapter ([../finetuning/finetune-results.md](../finetuning/finetune-results.md)) serves Task A (quiz generation). The app calls it via a vLLM OpenAI-compatible endpoint and **falls back to Gemini if `FINETUNED_MODEL_URL` is unset or unreachable** — so this is optional and can be added later.

### Serving option: vLLM on a GCE GPU VM

```bash
# Create a GPU VM (T4 is enough for 7B + LoRA in this config)
gcloud compute instances create edufx-vllm \
  --project=responsive-sun-491204-e0 \
  --zone=asia-northeast1-a \
  --machine-type=n1-standard-4 \
  --accelerator=type=nvidia-tesla-t4,count=1 \
  --maintenance-policy=TERMINATE \
  --image-family=common-cu121-debian-11 \
  --image-project=deeplearning-platform-release \
  --boot-disk-size=100GB

# On the VM: upload the adapter folder, then serve base + adapter together
pip install vllm
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --enable-lora \
  --lora-modules edufx=./edufx-qwen25-7b-lora/ \
  --port 8080
```

This exposes `/v1/chat/completions`. Point the backend at it by setting `FINETUNED_MODEL_URL=http://<vm-ip>:8080` in the Cloud Run env. The deployed backend uses `FINETUNED_MODEL_NAME=edufx`, matching the `--lora-modules edufx=...` name above.

### Cost note

A GPU VM does **not** scale to zero — it bills continuously while running. For a university project, start it only for demos and stop it afterward (`gcloud compute instances stop edufx-vllm`). The Gemini fallback keeps the app fully functional when the VM is off.

| Task | When VM is ON | When VM is OFF |
|------|---------------|----------------|
| Quiz generation (Task A) | Fine-tuned Qwen | Gemini 2.5 Flash (fallback) |
| Explanations (Task B) | Gemini (always) | Gemini (always) |

---

## Part 7 — Service Summary

| Component | Platform | Scales to zero | Cost when idle |
|-----------|----------|:--------------:|----------------|
| Backend (FastAPI) | Cloud Run | Yes | Free |
| Frontend (Next.js) | Cloud Run | Yes | Free |
| Database | Supabase | n/a | Free tier |
| AI (Gemini + embeddings) | Vertex AI | n/a | Pay per call |
| Fine-tuned model (vLLM) | GCE GPU VM | No | Billed while running — stop when idle |

## Part 8 — Pre-Deploy Checklist

- [ ] Part 1 GCP setup run (registry + both service accounts)
- [ ] All GitHub secrets added except `FRONTEND_URL`
- [ ] `SUPABASE_ANON_KEY` is anon/public/publishable; no `sb_secret_...` value is used in any `NEXT_PUBLIC_*` build arg
- [ ] Supabase schema applied (tables + `content_chunks` + `match_content_chunks` RPC)
- [ ] RAG notes ingested (55 chunks in `content_chunks`)
- [ ] First push to `main` succeeds in Actions
- [ ] `FRONTEND_URL` secret added after first deploy, workflow re-run
- [ ] `edufx-deploy-key.json` deleted from local machine
- [ ] (Optional) GPU VM + vLLM for the fine-tuned model
- [ ] (Optional) `FINETUNED_MODEL_URL` secret added only while the vLLM VM is running

---

## Source: `docs\deployment\groq-azure-fallback.md`

# Groq AI and Azure Deployment Fallback

> Azure is now the primary production path, not only a fallback. This page is
> retained for provider and deployment configuration detail.

This guide keeps EduFX usable when Vertex AI is disabled or the GCP project is
unavailable. Groq becomes the primary text-generation provider, while Azure
Container Apps provides a separate, manually triggered hosting path.

## What Changed

EduFX now uses a configurable text-provider chain:

```text
Fine-tuned quiz endpoint (quiz generation only, when configured)
  -> Groq
  -> Gemini API key
  -> Vertex AI
  -> deterministic application fallback
```

The order after the fine-tuned endpoint comes from `AI_PROVIDER_ORDER`. The
Azure workflow sets `groq,gemini,vertex` and sets `VERTEX_AI_ENABLED=false`, so
no Vertex request is attempted. Provider errors and rate limits are logged and
the next configured provider is tried.

The relevant implementation files are:

- `server/app/services/ai_service.py`: provider selection and fallback
- `server/app/core/config.py`: provider settings
- `server/app/core/clients.py`: enables AI features in Groq-only deployments
- `server/app/rag/embedder.py`: independent embedding-provider selection
- `.github/workflows/deploy-azure.yml`: Azure deployment
- `.github/workflows/deploy.yml`: GCP deployment with Groq-first generation

## Important: Generation and Embeddings Are Different

Groq is used for text generation, including the AI teacher, explanations, and
the general quiz fallback. The current Groq integration does not create the
`gemini-embedding-001` vectors used by EduFX RAG.

For Azure production, add an optional `GEMINI_API_KEY`. EduFX then uses the
Gemini API for embeddings without using the blocked Vertex project. This keeps
new query vectors compatible with the chemistry chunks already stored in
Supabase.

| Configuration | Text generation | RAG embeddings |
|---|---|---|
| Groq only | Works | Unavailable; retrieval returns no new query vector |
| Groq + Gemini API key | Groq first | Gemini API key |
| Vertex enabled | Configurable | Vertex first, Gemini API key fallback |

Do not switch to another embedding model unless all stored content chunks are
re-embedded with the same model and dimensions.

## 1. Create the Groq Production Key

1. Sign in at `https://console.groq.com`.
2. Open **API Keys** and create a key for EduFX production.
3. Copy it once and store it as the GitHub secret `GROQ_API_KEY`.
4. Never place it in the frontend, a `NEXT_PUBLIC_*` variable, source control,
   screenshots, or documentation.
5. Check the Groq model and rate-limit pages before a production demonstration.

The default model is `llama-3.3-70b-versatile`. It can be changed without a
code edit by setting the GitHub variable `GROQ_MODEL` to a currently supported
production model.

Azure deployment can still run before the Groq key is added if `GEMINI_API_KEY`
is already configured. In that temporary mode the provider order remains
`groq,gemini,vertex`, Groq is skipped because no key exists, Gemini handles text
generation and embeddings, and Vertex stays disabled.

## 2. Local Groq-First Configuration

Copy the server environment example to the repository root `.env`, then use:

```dotenv
DATA_BACKEND=supabase
DEMO_MODE=false

GROQ_API_KEY=gsk_replace_with_your_key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_TIMEOUT_SECONDS=45
AI_PROVIDER_ORDER=groq,gemini,vertex

VERTEX_AI_ENABLED=false
GOOGLE_CLOUD_PROJECT=

# Optional but recommended to preserve RAG embeddings without Vertex.
GEMINI_API_KEY=
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=384
```

Start the backend and inspect the non-sensitive provider status:

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
uvicorn app.main:app --reload --port 8001
Invoke-RestMethod http://localhost:8001/health/providers
```

Expected Groq-first result:

```json
{
  "text_provider_order": ["groq", "gemini", "vertex"],
  "groq_configured": true,
  "gemini_configured": false,
  "vertex_enabled": false,
  "finetuned_endpoint_configured": false,
  "embedding_provider": "none"
}
```

`embedding_provider` becomes `gemini` when `GEMINI_API_KEY` is configured.
No endpoint response contains secret values.

## 3. Azure Resources

The workflow deploys two Linux containers to Azure Container Apps and builds
their images in Azure Container Registry. It is the automatic production path
for pushes to `main` (and can also be started manually), scales both apps to
zero when idle, and runs smoke checks for the frontend route and diagnostic
authentication contract.

Install Azure CLI, sign in, and create the base resources once:

```powershell
az login
az account set --subscription "<subscription-id>"

$location = "centralindia"
$resourceGroup = "edufx-production"
$acr = "edufxacr901ad003"
$environment = "edufx-environment"

az group create --name $resourceGroup --location $location
az acr create --name $acr --resource-group $resourceGroup --sku Basic
az extension add --name containerapp --upgrade --yes
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.ContainerRegistry
az containerapp env create `
  --name $environment `
  --resource-group $resourceGroup `
  --location $location `
  --logs-destination none
```

Azure Container Registry names must be globally unique and contain only
letters and numbers.

## 4. GitHub OIDC Authentication

Use OpenID Connect instead of storing an Azure client secret. Create an Entra
application and service principal:

```powershell
$appName = "edufx-github-deploy"
$appId = az ad app create --display-name $appName --query appId -o tsv
$spObjectId = az ad sp create --id $appId --query id -o tsv
$subscriptionId = az account show --query id -o tsv
$tenantId = az account show --query tenantId -o tsv
$resourceGroupId = az group show --name $resourceGroup --query id -o tsv
$acrId = az acr show --name $acr --resource-group $resourceGroup --query id -o tsv

az role assignment create `
  --assignee-object-id $spObjectId `
  --assignee-principal-type ServicePrincipal `
  --role Contributor `
  --scope $resourceGroupId

az role assignment create `
  --assignee-object-id $spObjectId `
  --assignee-principal-type ServicePrincipal `
  --role AcrPush `
  --scope $acrId

# Required because the workflow grants each Container App identity AcrPull.
az role assignment create `
  --assignee-object-id $spObjectId `
  --assignee-principal-type ServicePrincipal `
  --role "User Access Administrator" `
  --scope $acrId
```

Create `azure-federated-credential.json` locally:

```json
{
  "name": "edufx-github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:thanoban/EduFX:environment:azure-production",
  "description": "EduFX Azure production deployment",
  "audiences": ["api://AzureADTokenExchange"]
}
```

Register it, then delete the local JSON file:

```powershell
az ad app federated-credential create `
  --id $appId `
  --parameters azure-federated-credential.json
Remove-Item -LiteralPath .\azure-federated-credential.json
```

The subject must exactly match the GitHub repository and Environment name.

## 5. GitHub Environment Configuration

In GitHub, open **Settings -> Environments**, create
`azure-production`, then add the following Environment secrets.

### Required secrets

| Secret | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | `$appId` from the OIDC setup |
| `AZURE_TENANT_ID` | `$tenantId` |
| `AZURE_SUBSCRIPTION_ID` | `$subscriptionId` |
| `SUPABASE_URL` | Backend and frontend Supabase project URL |
| `SUPABASE_KEY` | Backend key only |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend service-role key only |
| `SUPABASE_JWT_SECRET` | Backend JWT verification secret |
| `SUPABASE_ANON_KEY` | Public anon/publishable key for the frontend |
`SUPABASE_ANON_KEY` is the only Supabase key compiled into the browser. Never
use an `sb_secret_...` or service-role value for it.

At least one text-generation key must exist: `GROQ_API_KEY` or
`GEMINI_API_KEY`. Groq is recommended for production fallback, but the Azure
workflow can deploy with Gemini only until the Groq key is added.

### Optional secrets

| Secret | Purpose |
|---|---|
| `GEMINI_API_KEY` | Recommended existing RAG embedding fallback and secondary text provider |
| `GROQ_API_KEY` | Recommended Groq production text-generation key |
| `FINETUNED_MODEL_URL` | External OpenAI-compatible QLoRA model endpoint |

Daily reminder automation is currently disabled. The availability settings
remain active because they drive the adaptive scheduler, but EduFX does not
present an email-reminder control or claim to send scheduled email until a
verified production mail provider is configured.

Add these Environment variables, which are non-sensitive:

| Variable | Example |
|---|---|
| `AZURE_RESOURCE_GROUP` | `edufx-production` |
| `AZURE_CONTAINER_REGISTRY` | `edufxacr901ad003` |
| `AZURE_CONTAINERAPPS_ENVIRONMENT` | `edufx-environment` |
| `AZURE_BACKEND_APP` | `edufx-backend` |
| `AZURE_FRONTEND_APP` | `edufx-frontend` |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |

## 6. Deploy to Azure

1. Open the repository's **Actions** tab.
2. Select **Deploy Azure fallback**.
3. Select **Run workflow** on the intended branch.
4. Wait for the backend image, backend app, frontend image, and frontend app
   steps to finish.
5. Read the backend and frontend URLs from the final smoke-test log.

The workflow:

1. authenticates to Azure through GitHub OIDC;
2. builds both images in ACR;
3. creates or updates both Container Apps;
4. stores backend credentials as Container Apps secrets;
5. assigns managed identities for private ACR image pulls;
6. disables Vertex and selects Groq first;
7. sets the frontend URL as the backend CORS origin;
8. checks `/`, `/health/providers`, and the frontend home page.

## 7. Production Verification

Run these after deployment:

```powershell
$backend = "https://<backend-app>.<region>.azurecontainerapps.io"
$frontend = "https://<frontend-app>.<region>.azurecontainerapps.io"

Invoke-RestMethod "$backend/"
Invoke-RestMethod "$backend/health/providers"
Start-Process "$backend/docs"
Start-Process $frontend
```

Then verify authenticated product paths:

- sign in through the Azure frontend;
- ask the AI teacher a question and confirm a response;
- generate a quiz and submit it;
- request a wrong-answer explanation;
- when `GEMINI_API_KEY` is set, confirm grounded RAG context is returned;
- inspect Container App logs for provider fallback warnings.

Useful log command:

```powershell
az containerapp logs show `
  --name <backend-app> `
  --resource-group <resource-group> `
  --follow
```

## 8. Failover Behaviour

| Failure | Result |
|---|---|
| Vertex blocked | Skipped when `VERTEX_AI_ENABLED=false` |
| Groq unavailable or rate-limited | Gemini text fallback is attempted when its key exists |
| Groq and Gemini unavailable | Service returns its existing deterministic fallback where supported |
| Fine-tuned endpoint offline | Quiz generation continues through the configured provider order |
| No embedding provider | Core API remains available, but RAG retrieval cannot embed new queries |
| Azure cold start | First request can be slower because minimum replicas is zero |

## 9. Cost and Rollback

- Azure deployment is manual-only so it does not duplicate every GCP deploy.
- Both Container Apps use `min-replicas=0` and `max-replicas=3`.
- ACR image storage, logs, outbound traffic, Supabase, Groq, and optional Gemini
  API calls can still incur cost.
- Set budget alerts in Azure Cost Management and Groq usage limits before a
  demonstration.
- Stop using Azure by disabling ingress or deleting the two Container Apps.
  Delete the resource group only when every resource inside it is disposable.
- To restore Vertex generation, set `VERTEX_AI_ENABLED=true`, provide
  `GOOGLE_CLOUD_PROJECT`, and put `vertex` first in `AI_PROVIDER_ORDER`.

## 10. Troubleshooting

### AI features appear disabled

Call `/health/providers`. `groq_configured` must be `true`. The backend now
enables AI features when Groq, Gemini, Vertex, or the fine-tuned endpoint is
configured; a GCP project is no longer required.

### Groq returns 401

Replace the `GROQ_API_KEY` Environment secret and rerun the workflow. Do not
print the key in Actions logs.

### Groq returns 429

Check account rate limits, reduce simultaneous requests, or configure
`GEMINI_API_KEY` as the next provider. The service automatically tries the next
provider after an exception.

### RAG answers have no retrieved context

Set `GEMINI_API_KEY` and confirm `/health/providers` reports
`embedding_provider: gemini`. The Groq text key alone does not provide the
existing Gemini-compatible embeddings.

### Azure cannot pull an ACR image

Confirm the Container App has a system-assigned identity, that identity has
`AcrPull` on the registry, and the GitHub OIDC principal can create that role
assignment.

### Browser reports a CORS error

Confirm `FRONTEND_ORIGIN` matches the exact Azure frontend URL. EduFX also
allows HTTPS `*.azurecontainerapps.io` origins for Azure fallback deployments.

---

## Source: `docs\features\admin-analytics-and-student-management.md`

# Admin Analytics and Student Management

## Purpose

This feature gives staff or project reviewers a higher-level view of student
activity across the system.

It supports:

- student list view
- student detail view
- role management
- weak concept review
- focus trend review

## Frontend files

- [admin-students-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/admin/admin-students-screen.tsx)
- [admin-student-detail-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/admin/admin-student-detail-screen.tsx)

## Backend files

- [admin.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/admin.py)
- admin controller and admin service

## Main routes and endpoints

Frontend routes:

- `/admin`
- `/admin/[studentId]`

Backend endpoints:

- `GET /admin/students`
- `GET /admin/students/{student_id}`
- `PATCH /admin/students/{student_id}/role`

## Security model

Admin endpoints are protected differently from ordinary student endpoints.

They require:

- a bearer token
- verified identity
- admin status check

So this feature is not only analytics, it is also an authorization feature.

## What the admin list shows

The list page summarizes:

- total students
- average mastered subtopics
- average focus score
- diagnostic completion
- session totals
- last active date

## What the student detail page shows

The detail page shows:

- role
- per-subtopic progress
- weak concepts
- session history
- focus score where available

It can also promote or demote student roles, except self-role changes.

## Why this feature matters

This gives EduFX an educator or reviewer-facing surface.

Without admin views, the project would only support the student side.

With admin analytics, the system can also support:

- supervision
- progress auditing
- concept weakness review
- role-based management

---

## Source: `docs\features\authentication-and-session-management.md`

# Authentication and Session Management

## Purpose

This feature controls how a student enters EduFX, how the app restores a
session, and how the system protects inactive sessions.

EduFX supports:

- Google sign-in
- email/password sign-in
- an in-memory/demo path for local testing only
- automatic sign-out after inactivity

## Frontend files

- [login-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/auth/login-screen.tsx)
- [auth-provider.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/auth/auth-provider.tsx)
- [use-auth-guard.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/auth/use-auth-guard.ts)
- [auth-callback-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/auth/auth-callback-screen.tsx)
- [supabase.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/lib/supabase.ts)
- [storage.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/lib/storage.ts)

## Backend files

- [auth.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/auth.py)
- auth controller and auth service from the backend container

## Main routes and endpoints

Frontend routes:

- `/login`
- `/auth/callback`

Backend endpoints:

- `POST /auth/google`
- `GET /auth/check`

## Flow

1. Student opens `/login`.
2. The production login screen offers email/password or Google access.
3. Supabase handles browser authentication.
4. The frontend gets a Supabase access token.
5. EduFX sends that token to `POST /auth/google`.
6. The backend returns a `StudentProfile`.
7. The profile and token are cached in browser storage.
8. Shared API calls attach the cached bearer token automatically.
9. Route guards decide whether to send the student to:
   - `/diagnostic/self-assessment` if diagnostic is not complete
   - `/dashboard` if diagnostic is already complete

## Session safety

The auth provider also manages session safety:

- idle timeout: `30 minutes`
- sign-out clears:
  - cached student profile
  - auth token
  - last diagnostic cache
  - last session cache
  - last quiz result cache

If the student becomes inactive long enough, EduFX sends them back to:

- `/login?session=expired`

## Why this feature matters

This feature is the gateway to the whole system.

Without it:

- EduFX cannot know which student is active
- progress cannot be personalized
- admin protection cannot work
- the dashboard cannot load the correct study plan

## Backend authorization

Production routes do not trust a browser-provided student ID by itself. The
backend verifies the Supabase access token, resolves the corresponding student,
and rejects cross-student access with `403`.

The frontend keeps token forwarding centralized in
`client/src/lib/api.ts`. Screens and feature components should call the typed
API helpers instead of reading auth storage or building `Authorization` headers
themselves.

`GET /diagnostic/questions` returning `401` without a token is expected. The
in-memory backend may accept missing auth for isolated tests. The backend still
recognizes `demo:` tokens, but production rejection of those tokens is listed as
a Phase 0 task in [Current status and roadmap](../current-status-and-roadmap.md).

---

## Source: `docs\features\dashboard-and-adaptive-scheduler.md`

# Dashboard and Adaptive Scheduler

## Purpose

This feature gives the student a personalized study plan for the day instead of
a flat list of all topics.

The dashboard answers:

- what should I study next?
- which topics are weak?
- which topics are already strong and only need reinforcement?
- how much work should fit into today?

## Frontend files

- [dashboard-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/dashboard/dashboard-screen.tsx)

## Backend files

- [scheduler.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/scheduler.py)
- scheduling agent and scheduler service logic
- recommender engine and related ML integration

## Main routes and endpoints

Frontend route:

- `/dashboard`

Backend endpoint:

- `GET /scheduler/todays-plan/{student_id}`

## What the dashboard shows

The dashboard combines:

- next recommended topic
- weak topic count
- advanced topic count
- recent focus trend
- planned topics for today
- level distribution across subtopics

## Scheduling idea

EduFX does not just rank topics once.

It builds a realistic study plan by combining:

- weakness
- overdue pressure
- current level
- recent performance
- reinforcement balance
- availability and session length

The ranking path is DKT first, BKT second, and deterministic deadline/cooldown
rules last. Model scoring is used only when enough interaction history exists.
The scheduling agent then applies the student's free days and per-day time cap.

For an unconfigured student, the fallback result is usually described as:

- `2 weak + 1 strong`

That means:

- weak topics get priority
- strong topics still appear for maintenance

Configured students may receive a smaller plan or no plan on a non-free day.
They cannot freely choose an unrelated topic: study content is gated to the
active recommendation.

## Why this feature matters

This is one of the most important adaptive features in EduFX.

It turns student data into a daily decision:

- not just “how am I doing?”
- but “what should I do today?”

That is the practical value of the scheduler and recommender path.

---

## Source: `docs\features\diagnostic-and-level-assignment.md`

# Diagnostic and Level Assignment

## Purpose

This feature measures the student’s starting knowledge across the S-block
curriculum and assigns a starting level for each subtopic.

EduFX uses three levels:

- beginner
- intermediate
- advanced

## Frontend files

- [diagnostic-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/diagnostic/diagnostic-screen.tsx)
- diagnostic results screen and related route pages

## Backend files

- [diagnostic.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/diagnostic.py)
- diagnostic controller and diagnostic service
- rules and repositories that store per-subtopic level assignments

## Main routes and endpoints

Frontend routes:

- `/diagnostic`
- `/diagnostic/results`
- `/diagnostic/self-assessment`
- `/diagnostic/availability`

Backend endpoints:

- `GET /diagnostic/questions`
- `POST /diagnostic/submit`

## What happens

1. The student records an initial confidence self-assessment.
2. EduFX loads 40 authenticated diagnostic questions.
3. The UI shows one question at a time with a question map.
4. The student answers all questions.
5. The frontend submits all answers in one authenticated request.
6. The backend verifies ownership and scores the diagnostic per subtopic.
7. EduFX stores assigned levels for the student.
8. The student reviews results and configures availability.
9. The frontend refreshes the student profile and opens the adaptive dashboard.

Anonymous access to `GET /diagnostic/questions` returns `401`. This protects the
assessment bank and confirms the production authorization guard is active.

## Why it matters

The diagnostic is the unlock step for personalization.

Without diagnostic levels:

- the scheduler does not know which topics are weak
- the study notes cannot be chosen at the right level
- the first study plan cannot be built properly

## Main output

The main result is a set of level assignments per subtopic.

Those levels drive:

- scheduler priority
- content selection
- quiz difficulty spread
- progress tracking

---

## Source: `docs\features\index.md`

# EduFX Feature Guides

This section breaks EduFX into clear feature-level documents.

For deployed/optional/removed status and the active plan, first read
[Current status and roadmap](../current-status-and-roadmap.md).

Use these pages when you want to understand one part of the system without
reading the entire project guide.

## Core user journey

1. [Authentication and session management](authentication-and-session-management.md)
2. [Diagnostic and level assignment](diagnostic-and-level-assignment.md)
3. [Dashboard and adaptive scheduler](dashboard-and-adaptive-scheduler.md)
4. [Study content and level-aware notes](study-content-and-level-aware-notes.md)
5. [Quiz and session flow](quiz-and-session-flow.md)
6. [Results and AI explanations](results-and-ai-explanations.md)
7. [Behavioural tracking](../getting-started/behaviouraltracking.md)
8. [Progress tracking](progress-tracking.md)
9. [Settings and availability](settings-and-availability.md)
10. [Admin analytics and student management](admin-analytics-and-student-management.md)

## How to read these docs

Each feature page explains:

- the purpose of the feature
- the frontend pages and components involved
- the backend routes and services involved
- the data flow
- the main payloads or records
- the user-facing outcome

If you are new to EduFX, start with the authentication page and then follow the
core user journey order above.

---

## Source: `docs\features\progress-tracking.md`

# Progress Tracking

## Purpose

This feature shows long-term student progress across all subtopics.

It answers:

- which topics are advanced?
- which topics are still beginner?
- how many sessions has the student completed?
- what is the recent score trend?

## Frontend files

- [progress-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/progress/progress-screen.tsx)

## Backend files

- [progress.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/progress.py)
- progress controller and progress service

## Main routes and endpoints

Frontend route:

- `/progress`

Backend endpoints:

- `GET /progress/{student_id}`
- `GET /progress/{student_id}/{subtopic_id}`

## What the page shows

The progress page summarizes:

- advanced topics count
- beginner topics count
- total session count
- per-subtopic level
- last score
- total attempts
- recent trend

## Why this feature matters

The dashboard is about today.

The progress page is about the student’s longer learning map.

This gives the student and the admin a broader view of:

- growth
- stuck areas
- consistency over time

## Key data source

The progress feature depends on accumulated session history, not just one quiz.

That makes it the historical memory surface of the learning system.

---

## Source: `docs\features\quiz-and-session-flow.md`

# Quiz and Session Flow

## Purpose

This feature runs the actual assessment session for a subtopic.

It combines:

- study-to-quiz transition
- session creation
- question display
- answer collection
- optional webcam tracking

## Frontend files

- [webcam-check-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/webcam-check-screen.tsx)
- [quiz-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/quiz/quiz-screen.tsx)
- [use-webcam-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/use-webcam-tracker.ts)

## Backend files

- [quiz.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/quiz.py)
- quiz controller and quiz service
- results service, because submission closes the session

## Main routes and endpoints

Frontend routes:

- `/webcam-check`
- `/quiz/[id]`

Backend endpoints:

- `GET /quiz/{subtopic_id}/{student_id}`
- `POST /quiz/generate`

## Session idea

EduFX treats a quiz as a study session record.

That session later connects to:

- quiz score
- behaviour summary
- explanations
- progress update
- scheduler context

## Question generation modes

The quiz flow supports two modes:

### First attempt

- uses the manual question bank

### Repeat or personalized attempt

- can use generated or personalized quiz generation

This lets EduFX avoid giving the exact same session every time.

## What the UI does

The quiz screen handles:

- current question
- answer map
- completion percentage
- webcam tracking state
- final submission

The student must answer all questions before submission is enabled.

## Why this feature matters

This is where learning evidence is created.

Without the quiz flow, the system would have:

- a plan
- content
- no real performance signal

So this feature is the measurement layer of EduFX.

---

## Source: `docs\features\results-and-ai-explanations.md`

# Results and AI Explanations

## Purpose

This feature turns a finished quiz into actionable feedback.

It combines:

- quiz performance
- level movement
- focus summary
- wrong-answer review
- explanation generation
- next-free-day check-in

## Frontend files

- [results-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/results/results-screen.tsx)

## Backend files

- [results.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/results.py)
- [explanation.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/explanation.py)
- results service
- explanation service

## Main routes and endpoints

Frontend route:

- `/results/[id]`

Backend endpoints:

- `POST /results/submit-quiz`
- `GET /results/session/{session_id}/{student_id}`
- `GET /explanation/{session_id}/{student_id}`

## What happens

1. The student submits quiz answers.
2. EduFX scores the session.
3. The backend updates:
   - correct count
   - quiz score
   - current level
   - level change status
4. EduFX loads the finished session details.
5. EduFX also loads explanations for wrong answers.
6. The results page shows both performance and focus context.

## Why explanations matter

Scoring alone is not enough.

EduFX also explains:

- what was wrong
- what the correct answer was
- what concept needs review

That turns a quiz from grading into feedback.

## Why the next-free check-in matters

The results page also asks:

- when are you next free?

This helps the settings and scheduler path plan future study days more
intelligently.

So the results page is not only a summary page.

It is also a bridge into the next scheduling decision.

---

## Source: `docs\features\settings-and-availability.md`

# Settings and Availability

## Purpose

This feature lets the student shape how EduFX plans study time.

It controls:

- weekly free days
- session length per day
- sign-out and account session controls

## Frontend files

- [settings-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/settings/settings-screen.tsx)

## Backend files

- [settings.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/settings.py)
- settings controller and settings service

## Main routes and endpoints

Frontend route:

- `/settings`

Backend endpoints:

- `PUT /settings/{student_id}/availability`
- `POST /settings/{student_id}/next-free`

## What the page does

The settings page allows the student to choose:

- which days they are free
- how much time they usually have on each free day

Daily email reminders are currently disabled because no production email
delivery provider is configured. Availability remains active and is used by
the adaptive scheduler.

The reminder UI, API route, and scheduled GitHub workflow have been removed.
The legacy database column can remain for schema compatibility but has no
current product behavior.

It also gives:

- current profile details
- logout control
- session timeout explanation

## Why per-day availability matters

Not every day has the same amount of study time.

EduFX now supports:

- a different session length per day

That means:

- a busy weekday can stay short
- a weekend can be longer
- the scheduler can size the daily plan more realistically

## Why this feature matters

This is how the student teaches EduFX about real life constraints.

Without this feature, the scheduler would know:

- what is weak

but not:

- how much work realistically fits today

---

## Source: `docs\features\study-content-and-level-aware-notes.md`

# Study Content and Level-Aware Notes

## Purpose

This feature delivers study notes that match the student’s current level before
they attempt a quiz.

EduFX does not show the same note to every student. It tries to align the note
to the current mastery state for that subtopic.

## Frontend files

- [study-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/study/study-screen.tsx)

## Backend files

- [content.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/content.py)
- content controller and content service
- repositories that store the note body and subtopic metadata

## Main routes and endpoints

Frontend route:

- `/study/[id]`

Backend endpoints:

- `GET /content/subtopics`
- `GET /content/{subtopic_id}/{student_id}`

## What happens

1. The student chooses a subtopic from the dashboard plan.
2. EduFX loads the note for that student and subtopic.
3. The content route returns:
   - note body
   - subtopic title
   - group name
   - level
4. The study screen renders the note using Markdown.
5. The student then continues to webcam choice and quiz.

## Why the level matters

The same chemistry topic can be explained differently for:

- beginner
- intermediate
- advanced

That means the content feature helps the quiz make sense:

- beginners get guided explanation
- advanced students get leaner reinforcement

## User-facing outcome

The study page is the bridge between planning and assessment:

- dashboard decides what to study
- study page helps the student learn it
- quiz checks whether learning actually happened

---

## Source: `docs\finetuning\finetune-aws-hosting-guide.md`

# Hosting the Fine-Tuned Model on AWS (Free Credit)

This is the step-by-step guide for getting `edufx-qwen25-7b-lora` (trained per
[finetune-colab-guide.md](finetune-colab-guide.md)) running as a live GPU API,
using AWS's new-account free credit.

## Read this first — the honest tradeoff

This is **not an ongoing free tier**. New AWS accounts get **~$100–200 in
credit**, and the account (and the credit) **expires after 6 months, or when
the credit runs out — whichever comes first**. It also **requires a credit
card on file**. Once the window closes, either move the model off AWS or
start paying real GPU-hourly rates (`g4dn.xlarge` is ~$0.53/hr on-demand).

Set a **billing alarm** the day you launch the instance (step 5) so you don't
get surprised. **Stop the instance whenever you're not using it** — unlike
serverless options, this is a real box that bills by the hour while running,
whether or not it's actually generating a quiz.

Other options considered and why this one won:
- **Hugging Face ZeroGPU** — hosting your own Space needs paid PRO ($9/mo);
  the free tier only lets you *use* someone else's Space.
- **Modal.com** — a genuinely recurring $30/month free credit, no card
  required, would have been the lower-maintenance choice. AWS was chosen
  instead for this project.
- **Oracle Cloud Always Free (CPU)** — permanent and free forever, but
  quantized 7B CPU inference runs ~2-4 minutes per quiz generation. Ruled out
  in favor of AWS's GPU speed.

---

## 1. Launch the EC2 instance

1. AWS Console → **EC2** → **Launch Instance**.
2. AMI: search for **"Deep Learning AMI GPU PyTorch"** (has CUDA/drivers
   preinstalled — saves a lot of setup).
3. Instance type: **`g4dn.xlarge`** (1× T4 GPU, 16GB VRAM — fits Qwen2.5-7B in
   4-bit/bf16 with the adapter attached).
4. Storage: bump the root volume to **100GB** (the base model alone is several
   GB, plus the Deep Learning AMI itself is large).
5. **Security group**: add an inbound rule for **TCP port 8080** from your IP
   (or `0.0.0.0/0` if the Cloud Run backend needs to reach it — tighten this
   later if you care about exposure; there's no auth on the vLLM endpoint).
6. Launch, wait for it to reach "running", note the **public IPv4 address**.

## 2. Set a billing alarm (do this now, not later)

AWS Console → **Billing** → **Budgets** → create a budget alert well below
your credit balance (e.g. $50) so you get an email before the credit runs out
unexpectedly.

## 3. SSH in and serve the model

```bash
ssh -i your-key.pem ubuntu@<instance-public-ip>

pip install vllm

# Upload your adapter folder first (scp -r edufx-qwen25-7b-lora ubuntu@<ip>:~/),
# or clone it from wherever you stored it after training.

python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --enable-lora \
  --lora-modules edufx=./edufx-qwen25-7b-lora/ \
  --port 8080
```

This is the exact command already documented in
[finetune-colab-guide.md §17](finetune-colab-guide.md) for the original GCE
VM — no merge step needed, vLLM serves the base model + LoRA adapter
together and exposes a standard OpenAI-compatible `/v1/chat/completions`
endpoint at port 8080.

Run it in a way that survives your SSH session closing — either `tmux`/`screen`,
or set it up as a `systemd` service if you want it to survive reboots too.

## 4. Wire it into the backend

This reuses settings that **already exist** in the app — no new code, no new
config keys:

```
FINETUNED_MODEL_URL=http://<instance-public-ip>:8080
FINETUNED_MODEL_NAME=edufx
```

Set these in `.env` locally and as GitHub Actions secrets for production
(`server/app/tools` reads them via `app.core.config.Settings`, and
[ai_service.py](../server/app/services/ai_service.py)'s `_call_finetuned` is
already the first candidate tried in the quiz-generation fallback chain).

## 5. Stopping the instance

```bash
# From your local machine, with the AWS CLI configured:
aws ec2 stop-instances --instance-ids <instance-id>

# To resume later:
aws ec2 start-instances --instance-ids <instance-id>
```

Stopping (not terminating) preserves the disk, so `vllm serve ...` is a
one-line restart next time — but note the **public IP changes** on every
stop/start unless you allocate an Elastic IP (which has its own small hourly
cost while not attached to a running instance — factor that into your $50
alarm if you go that route). Update `FINETUNED_MODEL_URL` if the IP changes.

## 6. Verify it's actually being used

Once `FINETUNED_MODEL_URL` is set, the very next quiz generation should hit
this endpoint first. Check the vLLM server's terminal/logs on the EC2 box —
a real request will show up there. If it doesn't, the app silently fell
through to Gemini/Groq instead (by design — never a hard dependency), which
usually means the security group, IP, or port is misconfigured.

---

## Source: `docs\finetuning\finetune-azure-hosting-guide.md`

# Hosting the Fine-Tuned Model on Azure (On/Off GPU VM)

This is the step-by-step guide for getting `edufx-qwen25-7b-lora` (trained per
[finetune-colab-guide.md](finetune-colab-guide.md)) running as a live GPU API on
Azure, using an **on/off VM**: start it when you actually want to test or demo
the fine-tuned model, deallocate it the rest of the time so it costs nothing
while idle.

## Read this first — the honest tradeoff

A GPU VM bills **by the hour while running**, whether or not it's actually
generating a quiz — this is a real box, not a serverless endpoint. That's why
the on/off pattern matters: **deallocate the VM whenever you're not using it**.
Set a **budget alert** the day you launch the instance (step 2) so unexpected
usage doesn't quietly burn through your Azure credit.

Other options considered and why this one won:
- **Hugging Face ZeroGPU** — hosting your own Space needs paid PRO ($9/mo);
  the free tier only lets you *use* someone else's Space.
- **Modal.com** — a genuinely recurring $30/month free credit, no card
  required, would be the lower-maintenance choice if you didn't already have
  Azure credit sitting unused.
- **AWS EC2** — same shape as this guide (see
  [finetune-aws-hosting-guide.md](finetune-aws-hosting-guide.md)), but the
  user has Azure credit, not AWS, so Azure was chosen instead.

---

## 1. Launch the VM

1. Azure Portal → **Virtual Machines** → **Create**.
2. Image: **Ubuntu 22.04 LTS**.
3. Size: **`Standard_NC4as_T4_v3`** (1× T4 GPU, 16GB VRAM — same GPU class as
   AWS's `g4dn.xlarge`, fits Qwen2.5-7B in 4-bit with the adapter attached).
4. Authentication: SSH public key — download the private key.
5. Disk: bump the OS disk if the default is small; the base model download
   alone is several GB.
6. **Networking → Inbound port rules**: allow **SSH (22)** and add a custom
   rule for **TCP port 8080** (source: your IP, or the Cloud Run backend's
   egress range if you want to lock it down later — there's no auth on the
   vLLM endpoint itself).
7. Create, wait for it to reach "Running", note the **public IP address**.

## 2. Set a budget alert (do this now, not later)

Azure Portal → **Cost Management + Billing** → **Budgets** → create a budget
alert well below your credit balance so you get a warning before the credit
runs out unexpectedly.

## 3. SSH in and serve the model

```bash
ssh -i your-key.pem azureuser@<vm-public-ip>

pip install vllm

# Upload your adapter folder from your local machine first:
#   scp -i your-key.pem -r edufx-qwen25-7b-lora azureuser@<vm-public-ip>:~/

python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --enable-lora \
  --lora-modules edufx=./edufx-qwen25-7b-lora/ \
  --port 8080 \
  --host 0.0.0.0
```

This is the exact command already documented in
[finetune-colab-guide.md §17](finetune-colab-guide.md) and
[finetune-aws-hosting-guide.md](finetune-aws-hosting-guide.md) — no merge step
needed, vLLM serves the base model + LoRA adapter together and exposes a
standard OpenAI-compatible `/v1/chat/completions` endpoint at port 8080.

The first run downloads the ~14GB base model — expect 5-10 minutes before the
server is ready. Wait for `Uvicorn running on http://0.0.0.0:8080` in the logs.

## 4. Auto-start on boot (systemd service)

So that starting the VM is the *only* manual step — no need to SSH in and
re-run the vLLM command every time — set it up as a systemd service:

```bash
sudo tee /etc/systemd/system/edufx-vllm.service > /dev/null <<EOF
[Unit]
Description=EduFX vLLM Fine-tuned Model Server
After=network.target

[Service]
User=azureuser
WorkingDirectory=/home/azureuser
ExecStart=/usr/local/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --enable-lora \
  --lora-modules edufx=/home/azureuser/edufx-qwen25-7b-lora/ \
  --port 8080 \
  --host 0.0.0.0
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable edufx-vllm
sudo systemctl start edufx-vllm
```

Check it came up:

```bash
sudo journalctl -u edufx-vllm -f
```

From now on, starting the VM automatically starts the model server — no SSH
required for routine use.

## 5. Wire it into the backend

This reuses settings that **already exist** in the app — no new code, no new
config keys:

```
FINETUNED_MODEL_URL=http://<vm-public-ip>:8080
FINETUNED_MODEL_NAME=edufx
```

Set these in `.env` locally and as GitHub Actions secrets for production
(`server/app/core/config.py`'s `Settings` already reads both, and
[ai_service.py](../server/app/services/ai_service.py)'s `_call_finetuned` is
already the first candidate tried in the quiz-generation fallback chain).

## 6. Stop / start the VM

```bash
# Stop billing (from your local machine, with the Azure CLI configured):
az vm deallocate --resource-group <your-rg> --name <your-vm-name>

# Resume later:
az vm start --resource-group <your-rg> --name <your-vm-name>
```

Deallocating stops compute billing (disk storage still bills, but that's
minor). Because the systemd service is enabled, starting the VM again brings
the model server back up on its own.

**Note:** the public IP changes on every deallocate/start unless you attach a
**Static Public IP** (which has its own small idle cost — factor that into
your budget alert if you go that route). Update `FINETUNED_MODEL_URL` if the
IP changes.

## 7. Verify it's actually being used

Once `FINETUNED_MODEL_URL` is set and the VM is running, the very next quiz
generation should hit this endpoint first. Check the vLLM server's logs
(`sudo journalctl -u edufx-vllm -f`) — a real request will show up there. If
it doesn't, the app silently fell through to Gemini/Groq instead (by design —
never a hard dependency), which usually means the NSG rule, IP, or port is
misconfigured.

---

## Source: `docs\finetuning\finetune-colab-guide.md`

# EduFX Fine-Tune Guide - Colab Enterprise L4 (Viva Ready)

> Historical training guide. The QLoRA adapter is available, but current Azure
> production uses Groq because no fine-tuned serving endpoint is configured.

This is the EduFX fine-tuning path that actually worked end to end.

Final working setup:

- Platform: Google Cloud Colab Enterprise
- Runtime template: `g2-standard-4` with `NVIDIA L4 x1`
- Region used: `us-central1`
- Base model: `Qwen/Qwen2.5-7B-Instruct`
- Method: self-run QLoRA
- Training stack: `transformers + peft + trl + bitsandbytes + accelerate + datasets`
- Dataset used for the successful run:
  - `data/finetune/train.jsonl` = 5 records
  - `data/finetune/val.jsonl` = 1 record

This guide is the one to use for your viva because it reflects the final stable path, not the earlier failed experiments.

---

## 0. Result reference

The measured results of the successful run are now kept separately in:

- [RESULT_FINETUNE.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/RESULT_FINETUNE.md)

Use this guide for the process and setup. Use the results file for the final numbers and viva evidence.

---

## 1. What happened technically

We tried the free Colab / Unsloth route first. That path kept running into runtime-level issues:

- bf16 / fp16 grad scaler crashes
- dtype mismatch errors inside LoRA kernels
- fragile package-version interactions
- extra confusion from rerunning cells in mixed notebook state

So the final engineering decision was:

1. move from free Colab to Colab Enterprise using GCP credits
2. use an L4 GPU instead of a free T4
3. keep the training self-run so the learning value stays high
4. switch from the fragile Unsloth path to the standard Hugging Face QLoRA stack

That is a strong viva answer because it shows debugging, comparison, and a justified architecture choice.

---

## 2. What this fine-tune is for

Only Task A is fine-tuned:

- Task A: quiz generation -> fine-tuned
- Task B: explanations -> still live Gemini + RAG

Reason:

- quiz generation needs strict JSON structure and consistent MCQ style
- explanations depend on the student's exact wrong answer and current retrieved notes, so live generation is better

---

## 3. Dataset snapshot

Current local dataset:

- [train.jsonl](D:/PROJECTS/2ndYearProject/EduFX_MVC/data/finetune/train.jsonl)
- [val.jsonl](D:/PROJECTS/2ndYearProject/EduFX_MVC/data/finetune/val.jsonl)

Verified facts:

- `train.jsonl` has 5 records
- `val.jsonl` has 1 record
- each record asks for exactly 15 questions
- each output contains exactly:
  - 5 easy
  - 5 medium
  - 5 hard
- topic scope in the current dataset is `mixed_inorganic`, not only s-block

Important viva point:

This dataset is enough to prove the pipeline works, but it is too small to claim production-quality generalization.

---

## 4. Notebook title and runtime

Recommended notebook title:

`EduFX_Finetune_Guide_Qwen25_7B_L4`

Runtime template used:

- Machine type: `g2-standard-4`
- GPU: `NVIDIA L4 x1`
- Python: `3.12`
- Region: `us-central1`

From the notebook screen:

1. open the notebook in Colab Enterprise
2. connect it to the L4 runtime
3. verify CUDA before installing anything

---

## 5. Cell 1 - Verify GPU

```python
import torch

print("cuda available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))
    print("bf16 supported:", torch.cuda.is_bf16_supported())
```

Expected result on the successful path:

- `cuda available: True`
- `GPU: NVIDIA L4`

If CUDA is false, reconnect the runtime before doing anything else.

---

## 6. Cell 2 - Install the stable training stack

Use the standard Hugging Face stack, not Unsloth, for the final working path.

```python
%%capture
!pip install -U transformers peft trl accelerate bitsandbytes datasets sentencepiece
```

If the notebook already contains packages from older experiments, restart the runtime after this install.

Why this stack was chosen:

- it is the standard open fine-tuning workflow
- it exposes the real training loop
- it avoids the Unsloth-specific dtype failures we hit earlier
- it is easier to explain in a viva

---

## 7. Cell 3 - Upload dataset files

Upload these two files into `/content/` using the file sidebar:

- `train.jsonl`
- `val.jsonl`

They should appear as:

- `/content/train.jsonl`
- `/content/val.jsonl`

---

## 8. Cell 4 - Load tokenizer and 4-bit base model

```python
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

MODEL_ID = "Qwen/Qwen2.5-7B-Instruct"

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.float32,
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    torch_dtype=torch.float32,
)

model.config.use_cache = False

print("Model loaded.")
print(type(model).__name__)
```

Why this mattered:

- the base model is loaded in 4-bit to reduce memory
- compute is kept in float32 for stability
- this is still QLoRA because the frozen base is quantized and only LoRA adapters are trained

---

## 9. Cell 5 - Attach LoRA adapters

```python
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=8,
    lora_alpha=16,
    lora_dropout=0.0,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules="all-linear",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

for name, param in model.named_parameters():
    if param.requires_grad:
        print("Trainable dtype:", param.dtype)
        break
```

Why `r=8`:

- enough capacity for a narrow formatting task
- safer for a tiny dataset
- lighter than a larger adapter setup

---

## 10. Cell 6 - Format the dataset

```python
from datasets import load_dataset

def format_record(row):
    messages = [
        {"role": "user", "content": row["instruction"]},
        {"role": "assistant", "content": row["output"]},
    ]
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
    )
    return {"text": text}

train_ds = load_dataset("json", data_files="/content/train.jsonl", split="train")
val_ds = load_dataset("json", data_files="/content/val.jsonl", split="train")

train_ds = train_ds.map(format_record)
val_ds = val_ds.map(format_record)

print("Train records:", len(train_ds))
print("Val records:", len(val_ds))
print(train_ds[0]["text"][:500])
```

Important detail:

- older tutorials often show raw string concatenation
- here we use the tokenizer chat template so the input matches the model family correctly

---

## 11. Cell 7 - Train

This is the exact stable training style that produced the successful run.

```python
from trl import SFTTrainer, SFTConfig

trainer = SFTTrainer(
    model=model,
    processing_class=tokenizer,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    args=SFTConfig(
        output_dir="/content/edufx-checkpoints",
        dataset_text_field="text",
        max_length=3072,
        packing=False,
        num_train_epochs=3,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        warmup_steps=5,
        logging_steps=1,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        fp16=False,
        bf16=False,
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
        report_to="none",
        seed=42,
    ),
)

trainer_stats = trainer.train()

print(f"\nTraining complete.")
print(f"Time taken: {trainer_stats.metrics['train_runtime']:.0f} seconds")
print(f"Final loss: {trainer_stats.metrics['train_loss']:.4f}")
```

Two key notes:

1. In the TRL version used here, `SFTConfig` expects `max_length`, not `max_seq_length`.
2. We kept `fp16=False` and `bf16=False` in the final stable run to avoid the dtype instability that caused earlier failures.

---

## 12. Successful training result

The actual measured values are documented in:

- [RESULT_FINETUNE.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/RESULT_FINETUNE.md)

Interpretation:

- validation loss decreased each epoch
- the model learned the task format
- the run was stable and completed successfully
- because validation has only 1 record, these numbers are encouraging but not enough for a strong quality claim

---

## 13. Cell 8 - Save the adapter

```python
SAVE_PATH = "/content/edufx-qwen25-7b-lora"

model.save_pretrained(SAVE_PATH)
tokenizer.save_pretrained(SAVE_PATH)

print("Saved to:", SAVE_PATH)
```

Optional zip and download:

```python
import shutil
from google.colab import files

shutil.make_archive("/content/edufx-qwen25-7b-lora", "zip", SAVE_PATH)
files.download("/content/edufx-qwen25-7b-lora.zip")
```

---

## 14. Adapter files produced

After `model.save_pretrained()` and `tokenizer.save_pretrained()`, the adapter folder contains:

| File | What it is |
|------|-----------|
| `adapter_model.safetensors` | The actual trained LoRA delta weights (~50 MB) |
| `adapter_config.json` | LoRA config — base model pointer, r=8, alpha=16, target modules |
| `tokenizer_config.json` | Qwen2Tokenizer, model_max_length=131072, eos=`<\|im_end\|>` |
| `chat_template.jinja` | ChatML template — how inputs must be structured at inference time |
| `tokenizer.json` | Full tokenizer vocabulary |
| `README.md` | Auto-generated PEFT model card |

Key values confirmed in `adapter_config.json`:

- `base_model_name_or_path`: `Qwen/Qwen2.5-7B-Instruct`
- `peft_type`: `LORA`
- `r`: `8`
- `lora_alpha`: `16`
- `lora_dropout`: `0.0`
- `bias`: `none`
- `target_modules`: `q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj`
- `inference_mode`: `true`

---

## 15. Chat format the model learned (ChatML)

The model uses Qwen's ChatML format, not raw text. Every inference call must use this format:

```
<|im_start|>system
You are an A-Level Chemistry examiner.
<|im_end|>
<|im_start|>user
{instruction text}
<|im_end|>
<|im_start|>assistant
```

The tokenizer's `apply_chat_template` handles this automatically:

```python
messages = [
    {"role": "system", "content": "You are an A-Level Chemistry examiner."},
    {"role": "user",   "content": instruction},
]
text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
```

This matches exactly how `format_record` prepared the training data (Cell 6).

---

## 16. Inference demo (for viva or testing)

Run this in a Colab Enterprise notebook to prove the adapter works:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel
import torch, json

MODEL_ID  = "Qwen/Qwen2.5-7B-Instruct"
ADAPTER   = "/content/edufx-qwen25-7b-lora"   # or local path to adapter folder

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.float32,
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
base      = AutoModelForCausalLM.from_pretrained(MODEL_ID, quantization_config=bnb_config, device_map="auto")
model     = PeftModel.from_pretrained(base, ADAPTER)
model.eval()

instruction = (
    "You are an A-Level Chemistry examiner.\n"
    "Topic: Alkali metals. Block: s_block. Student level: mixed.\n\n"
    "Notes: Group 1 reactions, ionisation energies, periodic trends.\n\n"
    "Generate exactly 15 multiple-choice A-Level chemistry questions as a JSON array.\n"
    "The 15 questions must include exactly 5 easy, 5 medium, and 5 hard questions, in any order.\n"
    "Each object must have exactly these keys: question_text, option_a, option_b, option_c, option_d, "
    "correct_answer (value: A, B, C, or D), difficulty (value: easy, medium, or hard).\n"
    "Output raw JSON array only. No markdown, no explanation, no extra text."
)

messages = [
    {"role": "system", "content": "You are an A-Level Chemistry examiner."},
    {"role": "user",   "content": instruction},
]
text   = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(text, return_tensors="pt").to("cuda")

with torch.no_grad():
    out = model.generate(**inputs, max_new_tokens=4096, temperature=0.4, do_sample=True, pad_token_id=tokenizer.eos_token_id)

response = tokenizer.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
questions = json.loads(response)
print(f"Generated {len(questions)} questions")
print(f"Difficulties: {[q['difficulty'] for q in questions]}")
```

Expected output: 15 questions, 5 easy / 5 medium / 5 hard, raw JSON.

---

## 17. Integration into the EduFX app

### Architecture split

| Task | Model | Reason |
|------|-------|--------|
| Task A — quiz generation | Fine-tuned Qwen 2.5 7B | Strict JSON format, consistent MCQ style |
| Task B — explanations | Configured runtime text provider (Groq in Azure production) | Needs live RAG context and per-student wrong answer |

### Deployment option: GCE VM with vLLM

vLLM can serve the base model + LoRA adapter together without merging:

```bash
# On a GCE T4 VM
pip install vllm
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --enable-lora \
  --lora-modules edufx=./edufx-qwen25-7b-lora/ \
  --port 8080
```

vLLM exposes an OpenAI-compatible `/v1/chat/completions` endpoint at that port.

### Code change in `server/app/services/ai_service.py`

Add alongside `_call_vertex`:

```python
def _call_finetuned(prompt: str, endpoint_url: str) -> str:
    """Call the fine-tuned Qwen model via vLLM OpenAI-compatible endpoint."""
    import httpx
    payload = {
        "model": "edufx",
        "messages": [
            {"role": "system", "content": "You are an A-Level Chemistry examiner."},
            {"role": "user",   "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": 4096,
    }
    r = httpx.post(f"{endpoint_url}/v1/chat/completions", json=payload, timeout=60)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]
```

In `generate_quiz_questions`, swap the generation call:

```python
# Add FINETUNED_MODEL_URL to settings (empty string = use Gemini fallback)
if settings.finetuned_model_url:
    raw = _call_finetuned(prompt, settings.finetuned_model_url)
else:
    raw = _call_vertex(vertex_model, prompt, temperature=0.4, max_tokens=4096)
```

`generate_explanation` stays unchanged — always calls Vertex AI Gemini.

---

## 18. What to say in the viva

You can explain the work like this:

1. "We used self-run QLoRA rather than managed tuning because I wanted to learn and control the actual training loop."
2. "The first path used free Colab and Unsloth, but repeated bf16/fp16 and package-compatibility issues made that route unstable."
3. "We moved to Colab Enterprise on GCP credits with an NVIDIA L4, which gave a more reliable environment."
4. "We fine-tuned Qwen2.5-7B-Instruct in 4-bit using LoRA adapters, so memory stayed low while only a small percentage of parameters were trained."
5. "The dataset was intentionally treated as a pipeline proof: 5 training records and 1 validation record."
6. "The training completed successfully, validation loss decreased, and the result shows the pipeline works. The next step is scaling the dataset before claiming production readiness."

---

## 19. Limitations and next step

Current limitation:

- only 6 total examples were used

So this run proves:

- environment setup works
- data format works
- QLoRA training works
- adapter saving works

It does not yet prove:

- broad generalization
- robust chemistry coverage
- production-quality evaluation

The next serious step is to expand to at least 50 to 100 reviewed examples.

---

## 20. Why we did not use Vertex managed tuning for learning

Vertex tuning is still a valid production path, but it hides much of the training mechanics.

For this learning phase we intentionally wanted to understand:

- quantization
- LoRA
- chat templating
- optimizer and scheduler behavior
- train / validation loss
- adapter saving

That is why the Colab Enterprise path is the better viva story.

---

## Source: `docs\finetuning\finetune-dataset-format.md`

# Fine-Tune Dataset Format

The dataset contract used by the working Colab Enterprise run. The training stack changed during debugging; this format did not.

## File Format

JSONL — one JSON object per line, no outer array, no trailing commas.

```json
{"instruction": "...", "output": "..."}
{"instruction": "...", "output": "..."}
```

Files: `data/finetune/train.jsonl` (5 records) · `data/finetune/val.jsonl` (1 record)

## Required Keys

Each line must have exactly two top-level keys: `instruction` and `output`. No extras.

## Instruction Template

```
You are an A-Level Chemistry examiner.
Topic: <topic>. Block: <block>. Student level: <level>.

Notes:
<context notes>

Generate exactly 15 multiple-choice A-Level chemistry questions as a JSON array.
The 15 questions must include exactly 5 easy, 5 medium, and 5 hard questions, in any order.
Each object must have exactly these keys: question_text, option_a, option_b, option_c,
option_d, correct_answer (value: A, B, C, or D), difficulty (value: easy, medium, or hard).
Output raw JSON array only. No markdown, no explanation, no extra text.
```

The current dataset uses `Block: mixed_inorganic` — intentionally broader than s-block so the model learns format rather than memorising one topic.

## Output Schema

Each question object:

| Key | Allowed values |
|-----|----------------|
| `question_text` | string |
| `option_a` – `option_d` | string |
| `correct_answer` | `A` `B` `C` `D` |
| `difficulty` | `easy` `medium` `hard` |

Every record must contain exactly **15 questions** — 5 easy, 5 medium, 5 hard.

## Chat Template Note

The raw JSONL does not contain model-specific tokens. The notebook wraps each record at training time using `tokenizer.apply_chat_template()`. This keeps the data format model-agnostic — if you switch base models, only the wrapping step changes.

## Validation Script

Run before uploading to Colab:

```python
import json
from collections import Counter

for path in ["data/finetune/train.jsonl", "data/finetune/val.jsonl"]:
    with open(path, encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            row = json.loads(line)
            questions = json.loads(row["output"])
            assert len(questions) == 15, (path, i, len(questions))
            counts = Counter(q["difficulty"] for q in questions)
            assert counts == {"easy": 5, "medium": 5, "hard": 5}, (path, i, counts)

print("Dataset format valid.")
```

## Viva Summary

> "We kept the data contract strict: one instruction-output pair per line, raw JSON output only, exact 15-question difficulty split. That made the dataset machine-checkable and aligned it directly with the app's required response format."

---

## Source: `docs\finetuning\finetune-method.md`

# Fine-Tune Method

> The training method remains valid, but the adapter is optional in current
> Azure production. Current text generation uses Groq unless a fine-tuned
> endpoint is configured.

QLoRA on Qwen2.5-7B-Instruct, Colab Enterprise NVIDIA L4, standard Hugging Face stack. See [finetune-results.md](finetune-results.md) for the measured numbers.

## What We're Actually Teaching

The base model already knows chemistry from pretraining. Fine-tuning is not about adding chemistry knowledge — it teaches the EduFX-specific JSON output format and MCQ style. That is why a small task-specific dataset is enough to be useful.

## QLoRA in Plain Terms

Full fine-tuning updates every model weight — expensive in GPU memory, time, and cost. QLoRA combines two ideas to make it practical on a single GPU:

**Quantization** — the base model is loaded in 4-bit form. Memory drops dramatically; the base stays frozen.

**LoRA (Low-Rank Adaptation)** — instead of training the full frozen model, small trainable adapter layers are inserted. Only a tiny fraction of parameters are updated.

Together: frozen 4-bit base + trainable adapters on top.

## Why These Choices Were Made

| Decision | Reason |
|----------|--------|
| Colab Enterprise over free Colab | Free tier gave bf16/fp16 scaler crashes, dtype mismatches, and package conflicts |
| NVIDIA L4 over T4 | More VRAM, cleaner environment, reliable for 7B models in 4-bit |
| Qwen2.5-7B-Instruct | Strong instruction following, fits L4 in 4-bit, compatible with HF stack |
| Standard HF stack (no Unsloth) | More transparent training loop, easier to explain in a viva |

## Notebook Pipeline

1. Verify GPU (`torch.cuda.is_available()`)
2. Install stack (`transformers peft trl bitsandbytes accelerate datasets`)
3. Load tokenizer and 4-bit base model with `BitsAndBytesConfig`
4. Attach LoRA adapters via `get_peft_model()` with `r=8, lora_alpha=16`
5. Format JSONL records with `tokenizer.apply_chat_template()`
6. Run `SFTTrainer` for 3 epochs
7. Save adapter with `model.save_pretrained()`

## Chat Template

Raw JSONL stores clean `instruction` / `output` fields. The notebook wraps each example at training time into Qwen's ChatML format. This keeps the dataset model-agnostic — switching base models only changes the wrapping step, not the stored data.

## Loss Results

| Epoch | Train Loss | Val Loss |
|------:|----------:|---------:|
| 1 | 1.6117 | 1.2146 |
| 2 | 1.2979 | 1.1323 |
| 3 | 1.1886 | 1.0471 |

Decreasing validation loss confirms the adapter was learning. The validation set is 1 record, so these numbers are encouraging, not conclusive.

## What This Run Proves and Doesn't Prove

**Proves:** dataset format is valid, QLoRA setup works, training completes, adapter saves correctly.

**Does not prove:** strong generalisation, production readiness, stable performance across a broad syllabus. Dataset is 5 training + 1 validation record.

## Why Task B Was Not Fine-Tuned

Explanation generation depends on the student's specific wrong answer and live RAG context. A static fine-tune cannot capture that variability. Task B stays on the configured runtime provider plus RAG; current Azure uses Groq. Only Task A (quiz generation) uses the fine-tuned adapter when its endpoint is configured.

## Viva Answers

**"Why not RAG only?"**
RAG supplies facts at runtime but doesn't guarantee the EduFX JSON structure. Fine-tuning teaches format; RAG supplies content. They solve different problems.

**"Why not Vertex managed tuning?"**
Managed tuning hides the training mechanics. Self-run QLoRA gave direct control over quantisation, adapters, chat templating, and loss curves — better learning value and a clearer viva story.

**"Why did you change approach mid-way?"**
The original free-Colab/Unsloth route had repeated mixed-precision and library-compatibility failures. Moving to Colab Enterprise L4 with the standard HF stack was a deliberate engineering decision to improve reliability while keeping the training self-run.

---

## Source: `docs\finetuning\finetune-rag-data-plan.md`

# Fine-Tune & RAG Data Plan

EduFX uses two separate AI pipelines. Fine-tuning teaches the model *how to format* output. RAG injects *what to say* at runtime. Both are required.

## Pipeline Comparison

| | Fine-tuning | RAG |
|--|-------------|-----|
| Purpose | Teach EduFX JSON output format and MCQ style | Inject study facts at query time |
| Data format | JSONL | CSV → embeddings → pgvector |
| Runs during | Training (one-off) | Every API request |
| Current scope | `mixed_inorganic` (broader than s-block intentionally) | S-block notes, all 10 subtopics |
| Update cycle | Retrain adapter | Re-run ingest script |

## Current Dataset Files

```
data/finetune/train.jsonl   — 5 training records
data/finetune/val.jsonl     — 1 validation record
data/notes/s_block_notes.csv — 10 subtopics, 55 chunks in Supabase
```

## Why Fine-Tune Scope Is Broader Than S-Block

The fine-tune uses `mixed_inorganic` topics rather than only s-block because fine-tuning teaches structure, not facts. Broader chemistry variety reduces the risk of the model memorising one narrow topic. RAG then steers runtime answers back to the correct syllabus content.

**Rule:** RAG data stays aligned with the current topic scope. Fine-tune examples can be broader as long as the output format is identical.

## Fine-Tune Data Contract

Each JSONL line: `{"instruction": "...", "output": "..."}` — no wrapping array, no extra keys. Every output is a raw JSON array of exactly 15 MCQs (5 easy / 5 medium / 5 hard).

## RAG Data Contract

`data/notes/s_block_notes.csv` with columns `subtopic_id` and `body`. After editing the CSV, run the ingest pipeline:

```
write CSV -> python -m app.rag.ingest -> chunk (~250 words, 30-word overlap) ->
embed (optional provider) -> store in content_chunks. Current Azure retrieval
falls back to lexical ranking when no embedding provider is configured.
```

## Current Status

The dataset has 6 total examples — enough to prove the pipeline works, not enough for a strong production quality claim. Expanding to 50–100 reviewed examples is the recommended next step before claiming model quality.

## Viva Summary

> "We separated style learning from fact retrieval. Fine-tuning teaches the model how EduFX wants questions formatted, while RAG injects the actual study content at runtime. That keeps the system both consistent and updatable."

---

## Source: `docs\finetuning\finetune-results.md`

# Fine-Tune Results

> Historical training result. The adapter was trained successfully, but no
> fine-tuned serving endpoint is configured in current Azure production. See
> [Current status and roadmap](../current-status-and-roadmap.md).

Successful run completed on Colab Enterprise — Qwen2.5-7B-Instruct with QLoRA, NVIDIA L4, 263 seconds.

## Environment

| Item | Value |
|------|-------|
| Platform | Google Cloud Colab Enterprise |
| Region | `us-central1` |
| Machine | `g2-standard-4`, NVIDIA L4 × 1 |
| Python | 3.12 |
| Base model | `Qwen/Qwen2.5-7B-Instruct` |
| Method | QLoRA (4-bit base + LoRA adapters) |
| Stack | transformers · peft · trl · bitsandbytes · accelerate · datasets |

## Dataset

| File | Records |
|------|---------|
| `data/finetune/train.jsonl` | 5 |
| `data/finetune/val.jsonl` | 1 |

Each record produces exactly 15 questions: 5 easy, 5 medium, 5 hard. Topic scope: `mixed_inorganic`.

This size is sufficient to prove the pipeline works but not to claim production-quality generalisation.

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Epochs | 3 |
| Batch size (train / eval) | 1 / 1 |
| Gradient accumulation steps | 4 |
| Learning rate | 2e-4 |
| Warmup steps | 5 |
| Max length | 3072 |
| Optimizer | `paged_adamw_8bit` |
| fp16 / bf16 | both off (stability) |
| Gradient checkpointing | on |
| Seed | 42 |

## Measured Results

Total runtime: **263 seconds** · Final training loss: **1.3884**

| Epoch | Train Loss | Val Loss | Token Accuracy |
|------:|----------:|---------:|---------------:|
| 1 | 1.6117 | 1.2146 | 74.3 % |
| 2 | 1.2979 | 1.1323 | 75.2 % |
| 3 | 1.1886 | 1.0471 | 76.0 % |

Validation loss decreased each epoch — the adapter was learning the target format. Because the validation set is only 1 record, these numbers support "pipeline works" but not a strong quality claim.

## Adapter Output

Files produced by `model.save_pretrained()` + `tokenizer.save_pretrained()`:

| File | Purpose |
|------|---------|
| `adapter_model.safetensors` | Trained LoRA delta weights (~50 MB) |
| `adapter_config.json` | r=8, alpha=16, 7 target projection layers |
| `tokenizer_config.json` | Qwen2Tokenizer, 128k context, ChatML tokens |
| `chat_template.jinja` | ChatML format required at inference |
| `tokenizer.json` | Full vocabulary |

## Integration

Task A (quiz generation) routes to the fine-tuned Qwen via an optional
OpenAI-compatible endpoint. Task B (explanations) stays on the configured
runtime provider plus RAG; current Azure production uses Groq. See
[finetune-colab-guide.md](finetune-colab-guide.md) for the integration code.

## Viva Statement

> "The fine-tune completed successfully on Colab Enterprise with an NVIDIA L4. Training and validation loss both improved across three epochs, and the adapter was saved. With only 5 training records I treat this as a pipeline proof, not a production-quality model — the clear next step is expanding to 50–100 reviewed examples."

---

## Source: `docs\finetuning\finetune-vertex-plan.md`

# Vertex Managed Tuning Plan

This is the managed-tuning alternative to the Colab self-run path. It was not used for the primary viva run. Use [finetune-colab-guide.md](finetune-colab-guide.md) for the path that actually ran.

## When to Use This Path

Vertex managed tuning is worth considering when the dataset grows large enough to justify it (50+ examples) and you want Google-managed infrastructure with simpler hosting. For the viva, the self-run QLoRA path is the better story because it demonstrates understanding of the training mechanics.

## Data Format Difference

The local JSONL format is not directly compatible with Vertex. A conversion step is required.

**Local format:**
```json
{"instruction": "...", "output": "..."}
```

**Vertex format:**
```json
{
  "systemInstruction": {"role": "system", "parts": [{"text": "You are an A-Level Chemistry examiner."}]},
  "contents": [
    {"role": "user",  "parts": [{"text": "<instruction>"}]},
    {"role": "model", "parts": [{"text": "<output>"}]}
  ]
}
```

## Conversion Script

```python
import json

SYSTEM = "You are an A-Level Chemistry examiner."

def convert(src, dst):
    rows = []
    with open(src, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            r = json.loads(line)
            rows.append({
                "systemInstruction": {"role": "system", "parts": [{"text": SYSTEM}]},
                "contents": [
                    {"role": "user",  "parts": [{"text": r["instruction"]}]},
                    {"role": "model", "parts": [{"text": r["output"]}]},
                ],
            })
    with open(dst, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

convert("data/finetune/train.jsonl", "data/finetune/vertex_train.jsonl")
convert("data/finetune/val.jsonl",   "data/finetune/vertex_val.jsonl")
```

## Minimum Dataset Size

Vertex managed tuning requires at least 16 examples to satisfy platform constraints. The current dataset (5 train + 1 val) is too small. Expand to 50–100 reviewed examples before using this path.

## Recommended Future Workflow

1. Expand dataset to 50–100 examples
2. Run the conversion script above
3. Upload to GCS: `gs://edufx-finetune/vertex_train.jsonl`
4. Launch the managed tuning job in the GCP Console → Vertex AI → Fine-tuning
5. Compare tuned-model output against the self-run QLoRA adapter from [finetune-results.md](finetune-results.md)

## Viva Answer

> "Vertex managed tuning is a valid production path, but for this phase I wanted to understand the actual mechanics — quantisation, adapters, loss curves. Vertex hides those details. Once the dataset grows large enough, managed tuning would simplify operations."

---

## Source: `docs\getting-started\adaptive-system-learning-guide.md`

# EduFX Adaptive System Learning Guide

> This is the learning-oriented explanation. For the deployed configuration,
> verified behavior, and active roadmap, see
> [Current status and roadmap](../current-status-and-roadmap.md).

This guide explains the full adaptive-learning part of EduFX from the basics.
It is written for someone who wants to learn the system through this project,
not just run it.

If you currently feel "I do not understand the agent, the models, or the
integration", start here first.

## What EduFX Is Doing

EduFX is not just "one AI model". It is a pipeline with different parts doing
different jobs:

1. The recommender models estimate what a student likely knows.
2. The scheduling agent turns those estimates into a realistic daily plan.
3. The AI teacher agent answers questions and writes grounded student reports.
4. The quiz generation layer creates new questions for a student's level.
5. The quiz review agent checks those generated MCQs before students see them.
6. The explanation layer explains wrong answers using notes plus an LLM.
7. The RAG layer supplies topic-specific grounding text to the LLM features.

So the system is adaptive in two different ways:

- Adaptive recommendation:
  decide what to study next
- Adaptive content generation:
  decide what kind of quiz or explanation to generate
- Adaptive teaching/support:
  explain student performance with grounded AI teacher responses

## The Big Picture

```text
Student logs in
  -> completes diagnostic
  -> gets progress records per subtopic
  -> studies a topic
  -> takes a quiz
  -> quiz result updates progress + streak
  -> recommender ranks all subtopics
  -> scheduling agent caps that list for today
  -> dashboard shows today's plan
```

At the same time:

```text
If student has prior sessions on a subtopic
  -> quiz service tries AI quiz generation
  -> optional fine-tuned model, then configured text-provider order
  -> weak concepts + RAG context are injected into the prompt
```

And for explanations:

```text
Wrong answer
  -> retrieve relevant notes chunks
  -> explanation prompt
  -> configured text-provider order (Groq in current Azure production)
  -> short explanation returned
```

## System Layers

### 1. Recommendation and Scheduling

This is the "what should I study next?" part.

Relevant files:

- [server/app/services/scheduling_agent.py](../server/app/services/scheduling_agent.py)
- [server/app/ml/recommender_engine.py](../server/app/ml/recommender_engine.py)
- [server/app/ml/recommender.py](../server/app/ml/recommender.py)
- [server/app/ml/dkt.py](../server/app/ml/dkt.py)
- [server/app/ml/bkt.py](../server/app/ml/bkt.py)

### 1B. Teacher and Review Agents

This is the "coach the student safely" part.

Relevant files:

- [server/app/agents/dossier.py](../server/app/agents/dossier.py)
- [server/app/agents/teacher_graph.py](../server/app/agents/teacher_graph.py)
- [server/app/agents/quiz_review.py](../server/app/agents/quiz_review.py)
- [server/app/services/teacher_service.py](../server/app/services/teacher_service.py)
- [server/app/routes/teacher.py](../server/app/routes/teacher.py)

### 2. Quiz Generation

This is the "generate questions for this student" part.

Relevant files:

- [server/app/services/quiz_service.py](../server/app/services/quiz_service.py)
- [server/app/services/ai_service.py](../server/app/services/ai_service.py)
- [server/app/agents/quiz_review.py](../server/app/agents/quiz_review.py)
- [../finetuning/finetune-method.md](../finetuning/finetune-method.md)
- [../finetuning/finetune-results.md](../finetuning/finetune-results.md)

### 3. Explanations and RAG

This is the "explain the student's mistake using topic notes" part.

Relevant files:

- [server/app/services/explanation_service.py](../server/app/services/explanation_service.py)
- [server/app/repositories/rag_repository.py](../server/app/repositories/rag_repository.py)
- [server/app/rag/retriever.py](../server/app/rag/retriever.py)
- [server/app/rag/embedder.py](../server/app/rag/embedder.py)

## Recommendation System From Basic Concepts

### What problem are we solving?

A student does not need every topic every day.

We need to decide:

- which topic is weak
- which topic is overdue for revision
- which new topic is unlocked by prerequisites
- which topic is in the right challenge zone

That is what the recommender plus scheduling agent does.

### Why two trained recommender models?

EduFX uses two knowledge-tracing models:

- `BKT`:
  Bayesian Knowledge Tracing, classical and interpretable
- `DKT`:
  Deep Knowledge Tracing, an LSTM sequence model

Why both?

- BKT is easier to explain and is a good baseline
- DKT can learn cross-topic transfer that BKT cannot
- comparing both gives stronger academic evidence

### What data do these models read?

They do not read raw chemistry notes. They read student interaction history:

- subtopic attempted
- correct or wrong
- focus score
- whether focus tracking was enabled

That history is flattened into a sequence in
[server/app/ml/recommender.py](../server/app/ml/recommender.py).

### Why was synthetic data used?

Deep sequence models need many student histories. At the start of the project,
there were not enough real EduFX student logs, so the recommender training
pipeline used a simulator to generate realistic sequences.

The simulator is documented in
[../ml-recommender/recommender-colab-training.md](../ml-recommender/recommender-colab-training.md)
and explained slowly in
[../ml-recommender/recommender-learning-basics.md](../ml-recommender/recommender-learning-basics.md).

## Recommender Flow In Code

This is the actual backend flow:

```text
/scheduler/todays-plan/{student_id}
  -> SchedulerController
  -> SchedulingAgent.get_todays_plan()
  -> RecommenderEngine.rank_candidates()
  -> DKTInference.load() if available
  -> else BKTModel.load() if available
  -> else rule-based fallback
  -> return ranked subtopics
  -> SchedulingAgent caps by availability
  -> frontend gets today's plan
```

Files:

- Route:
  [server/app/routes/scheduler.py](../server/app/routes/scheduler.py)
- Controller:
  [server/app/controllers/scheduler_controller.py](../server/app/controllers/scheduler_controller.py)
- Agent:
  [server/app/services/scheduling_agent.py](../server/app/services/scheduling_agent.py)
- Ranking engine:
  [server/app/ml/recommender_engine.py](../server/app/ml/recommender_engine.py)

## Scheduling Agent Role

The scheduling agent is not the same thing as the trained model.

The trained model says:

- "this topic seems weak"
- "this topic seems strong"
- "this topic is likely answerable with probability x"

The scheduling agent then applies real product rules:

- how many topics today
- whether today is a free day
- whether the student promised to study today
- how to mix weak and strong topics
- how to update streaks after study

That separation is good design:

- `RecommenderEngine` decides what is important
- `SchedulingAgent` decides what is practical today

## Teacher Agent Role

EduFX also has a separate teacher-agent path.

This agent does not change progress or planning.
It is read-only and grounded on student data.

Its flow is:

```text
/teacher/{student_id}/chat or /teacher/{student_id}/report
  -> TeacherController
  -> TeacherService
  -> build_student_dossier(...)
  -> teacher graph
  -> grounding guard
  -> teacher reply/report
```

The teacher graph uses three specialist roles:

- analyst
- diagnostician
- coach

Then it synthesizes them into one final answer.

The grounding guard removes invented percentages that do not appear in the
student dossier.

This is a strong safety feature because educational feedback should not invent
performance numbers.

## Quiz Review Agent Role

EduFX also has a quiz self-check agent.

Its purpose is to verify LLM-generated MCQs before they reach a student.

Flow:

```text
QuizService generates questions
  -> quiz_review.verify
  -> keep valid questions
  -> optionally regenerate missing replacements
  -> final reviewed set
```

This means EduFX does not blindly trust generated answer keys.

Important design detail:

- if the reviewer output is unusable, the system keeps the original quiz
- this is a fail-open safety net, not a hard blocker

## Recommender Results and Measured Performance

### Knowledge-tracing quality

Fresh synthetic holdout results used in the project:

| Model | Held-out ROC-AUC |
|------|------------------:|
| Base-rate baseline | 0.5000 |
| BKT | 0.6569 |
| DKT | 0.6822 |

DKT beat BKT by `+0.0253`.

Interpretation:

- both models learned useful signal
- DKT performed best
- the gain is real but not huge, which is normal on a small syllabus

Important honesty note:

These are synthetic-holdout numbers. They validate the artifact and pipeline,
but they do not prove real classroom impact yet.

### Recommender latency

Measured inference latency on a 55-step history from prior project evaluation:

| Model | Inference latency |
|------|-------------------:|
| BKT | 0.2366 ms |
| DKT | 1.3075 ms |

So DKT is slower than BKT, but still extremely fast.

### Current backend route performance

The live scheduler route was recently profiled and optimized in this repo.

After bulk-loading session attempts instead of doing one query per session:

- local cold-start agent:
  p95 about `0.024 ms`
- local DKT-history agent:
  p95 about `3.236 ms`
- Supabase `/scheduler/todays-plan` route:
  median about `0.94 s`

The remaining delay is mostly database/network time, not model math.

## Fine-Tuned Quiz Model

EduFX also has a separate trained model for quiz generation.

This is a different problem from recommendation:

- recommender models predict what the student should study next
- fine-tuned LLM generates new MCQ questions in EduFX format

### Model and method

The trained quiz model setup was:

- base model:
  `Qwen/Qwen2.5-7B-Instruct`
- method:
  QLoRA
- hardware:
  Colab Enterprise, NVIDIA L4
- stack:
  `transformers`, `peft`, `trl`, `bitsandbytes`, `accelerate`, `datasets`

### Fine-tune results

| Metric | Value |
|------|-------|
| Runtime | 263 seconds |
| Final training loss | 1.3884 |
| Train records | 5 |
| Validation records | 1 |

Per-epoch results:

| Epoch | Train Loss | Val Loss | Token Accuracy |
|------:|-----------:|---------:|---------------:|
| 1 | 1.6117 | 1.2146 | 74.3% |
| 2 | 1.2979 | 1.1323 | 75.2% |
| 3 | 1.1886 | 1.0471 | 76.0% |

Interpretation:

- the adapter learned the target JSON format
- training was successful
- dataset is too small for strong production claims

See:

- [../finetuning/finetune-results.md](../finetuning/finetune-results.md)
- [../finetuning/finetune-method.md](../finetuning/finetune-method.md)
- [../finetuning/finetune-colab-guide.md](../finetuning/finetune-colab-guide.md)

## Quiz Generation Integration Method

The quiz generation integration is not "always use one provider".

Provider selection in `server/app/services/ai_service.py` is configurable.
Current Azure production uses:

```text
Fine-tuned endpoint
  -> Groq
  -> deterministic quiz fallback when supported
```

That means:

- if the self-hosted fine-tuned model is live, it is used first
- the current production endpoint is not configured, so Groq is used
- if a candidate fails, the backend tries the next configured candidate
- the feature still works even when the fine-tuned host is offline

The quiz service integration is in
[server/app/services/quiz_service.py](../server/app/services/quiz_service.py).

For personalized quizzes it combines:

- student level
- current subtopic notes
- RAG chunks
- weak concepts from previous mistakes

Then it asks the LLM for exactly 15 questions.

Before the questions are finally served, EduFX can pass them through the quiz
review graph so obviously invalid answer keys are filtered or replaced.

## Explanation Integration Method

Explanations are handled differently from quiz generation.

The project intentionally does not use the fine-tuned model for explanations.

Reason:

- explanations depend on the exact wrong answer
- explanations need live note context
- that is better handled by runtime generation plus RAG

Current Azure explanation provider order:

```text
Groq
  -> deterministic explanation fallback when supported
```

File:

- [server/app/services/explanation_service.py](../server/app/services/explanation_service.py)

## RAG Integration Method

RAG means Retrieval-Augmented Generation.

In EduFX it works like this:

1. Store note chunks for each subtopic in Supabase `content_chunks`
2. Embed the user query or topic query
3. Retrieve top matching chunks
4. Add them into the LLM prompt

Current implementation note:

The original Supabase RPC path for pgvector retrieval was unreliable, so the
project now retrieves rows from `content_chunks` and does cosine ranking in
Python. That current logic is in
[server/app/rag/retriever.py](../server/app/rag/retriever.py).

This is a good example of practical engineering:

- the planned architecture was more "database-native"
- the observed runtime behaviour was flaky
- the implementation was changed to the simpler reliable option

## Where the Main Adaptive Files Live

```text
server/app/
  core/
    container.py
    rules.py
  ml/
    recommender.py
    recommender_engine.py
    bkt.py
    dkt.py
    artifacts/
  services/
    scheduling_agent.py
    teacher_service.py
    quiz_service.py
    explanation_service.py
    results_service.py
    ai_service.py
  agents/
    dossier.py
    teacher_graph.py
    quiz_review.py
    prompts.py
  rag/
    embedder.py
    retriever.py
  repositories/
    rag_repository.py
    scheduler_repository.py
    progress_repository.py
    results_repository.py
    supabase_*.py
```

## How the Pieces Connect

The full dependency wiring happens in
[server/app/core/container.py](../server/app/core/container.py).

That file creates:

- repositories
- `RecommenderEngine`
- `SchedulingAgent`
- `QuizService`
- `ExplanationService`
- `ResultsService`

This is the place to read if you want to understand how the project is glued
together.

## Best Learning Order

If you are new to this kind of development, study in this order:

1. Read [../ml-recommender/recommender-learning-basics.md](../ml-recommender/recommender-learning-basics.md)
2. Read [agent-learning-guide.md](agent-learning-guide.md)
3. Read [server/app/core/container.py](../server/app/core/container.py)
4. Read [server/app/services/scheduling_agent.py](../server/app/services/scheduling_agent.py)
5. Read [server/app/ml/recommender_engine.py](../server/app/ml/recommender_engine.py)
6. Read [server/app/ml/recommender.py](../server/app/ml/recommender.py)
7. Read [server/app/agents/dossier.py](../server/app/agents/dossier.py)
8. Read [server/app/agents/teacher_graph.py](../server/app/agents/teacher_graph.py)
9. Read [server/app/agents/quiz_review.py](../server/app/agents/quiz_review.py)
10. Read [../finetuning/finetune-method.md](../finetuning/finetune-method.md)
11. Read [../finetuning/finetune-results.md](../finetuning/finetune-results.md)
12. Read [server/app/services/quiz_service.py](../server/app/services/quiz_service.py)
13. Read [server/app/services/explanation_service.py](../server/app/services/explanation_service.py)

## Short Viva Version

If you need a short explanation in a viva, say this:

> EduFX uses a layered adaptive-learning architecture. For recommendation, the
> backend builds a student interaction history from quiz attempts and focus
> signals, then runs DKT first, BKT second, and rule-based fallback if there is
> not enough data. The SchedulingAgent converts that ranking into a realistic
> daily plan using availability and session length. The repo also has a
> LangGraph teacher agent that answers grounded progress questions and writes
> student reports, plus a quiz-review agent that checks generated MCQs before
> delivery. For quiz generation, a fine-tuned Qwen adapter is tried first, then
> general LLM fallbacks. For wrong answer explanations, the system retrieves
> note chunks and generates a short explanation with a live LLM. So planning,
> teaching, generation, and explanation are separate adaptive layers, not one
> single model.

---

## Source: `docs\getting-started\agent-learning-guide.md`

# EduFX Agent Learning Guide

This guide explains the real agent structure that exists in EduFX today.

The important update is this:

EduFX no longer has only one "agent" idea.

It now has **two agent families**:

1. **Deterministic planning agent**
   - `SchedulingAgent`
   - decides how much study content to serve today
   - never calls an LLM
2. **LangGraph AI agent layer**
   - AI teacher graph
   - quiz self-check graph
   - both use LLMs, but both are grounded and read-only

So if someone asks, "What are the agents in EduFX?", the correct answer is:

> EduFX has one deterministic scheduling agent for planning, and a separate
> LangGraph agent layer for AI teacher responses and quiz-quality review.

---

## 1. The Three Actual Agents

### A. `SchedulingAgent`

File:

- [server/app/services/scheduling_agent.py](../../server/app/services/scheduling_agent.py)

Purpose:

- take the recommender's ranked subtopics
- cap them by student availability and session length
- keep weak/strong balance
- update streak data after completed study sessions

This is **not** an LLM agent.
It is a deterministic product-policy agent.

### B. AI Teacher Graph

Files:

- [server/app/agents/teacher_graph.py](../../server/app/agents/teacher_graph.py)
- [server/app/agents/dossier.py](../../server/app/agents/dossier.py)
- [server/app/services/teacher_service.py](../../server/app/services/teacher_service.py)
- [server/app/routes/teacher.py](../../server/app/routes/teacher.py)

Purpose:

- answer student questions about their own progress
- generate an auto-written progress report
- use the student's real study data as grounding context

This is a **LangGraph supervisor-style agent**.

### C. Quiz Self-Check Graph

Files:

- [server/app/agents/quiz_review.py](../../server/app/agents/quiz_review.py)
- [server/app/services/quiz_service.py](../../server/app/services/quiz_service.py)

Purpose:

- check whether generated MCQ answer keys are actually correct
- drop invalid questions
- optionally regenerate replacement questions
- fail open if the reviewer output is unusable

This is a **LangGraph verify -> fix reflection loop**.

---

## 2. High-Level Architecture

```text
EduFX agent layer
  |
  +-- Deterministic planning
  |     SchedulingAgent
  |       -> uses RecommenderEngine output
  |       -> applies free-day/session-length caps
  |       -> updates streaks
  |
  +-- AI teacher
  |     dossier builder
  |       -> build grounded student snapshot
  |     teacher graph
  |       -> analyst
  |       -> diagnostician
  |       -> coach
  |       -> synthesis
  |       -> grounding guard
  |
  +-- Quiz self-check
        review graph
          -> verify generated MCQs
          -> regenerate if needed
          -> return safe final set
```

---

## 3. SchedulingAgent — The Planning Agent

### What it does

`SchedulingAgent` is the practical planning layer.

It does not decide topic importance from scratch.
Instead:

1. `RecommenderEngine` ranks subtopics
2. `SchedulingAgent` decides what is realistic for **today**

### Main methods

- `get_todays_plan(student_id)`
- `register_study_session(student_id)`
- `_resolve_cap(student, today)`
- `_select_capped(scored, cap)`

### Core idea

Separate these responsibilities:

1. **Prediction**:
   what seems important next?
2. **Product decision**:
   how much should the student actually see today?

EduFX keeps that split clean:

- `RecommenderEngine` -> ranking and model use
- `SchedulingAgent` -> availability, caps, weak/strong mix, streaks

### Request flow

```text
Frontend dashboard
  -> GET /scheduler/todays-plan/{student_id}
  -> routes/scheduler.py
  -> SchedulerController
  -> SchedulingAgent.get_todays_plan()
  -> RecommenderEngine.rank_candidates()
  -> SchedulingAgent caps/fills result
  -> StudyPlanItemDTO list returned
```

### Why this matters

This is why EduFX feels like a real learning product instead of a plain model
demo. The model can rank many things as useful, but the agent decides:

- is today even a study day?
- how many topics fit today's time budget?
- should we mix weak and strong items?

---

## 4. AI Teacher Graph — The Read-Only LangGraph Agent

### What it does

The AI teacher is used for:

- student chat about their own performance
- auto-generated progress reports

It is **read-only**:

- it does not change student data
- it does not change schedules
- it does not write new progress records

### The real flow

```text
/teacher/{student_id}/chat
or
/teacher/{student_id}/report

  -> TeacherController
  -> TeacherService
  -> build_student_dossier(...)
  -> dossier_to_prompt_context(...)
  -> teacher_graph.invoke(...)
  -> grounded teacher reply/report
```

### The specialist nodes

Inside
[server/app/agents/teacher_graph.py](../../server/app/agents/teacher_graph.py),
the graph can run three specialist roles:

- `analyst`
  - what the student has done
  - scores, activity, streak
- `diagnostician`
  - weak concepts
  - recurring mistakes
  - focus issues if visible
- `coach`
  - what to improve next
  - study advice
  - not scheduling advice

Then a synthesis node combines them into one final answer.

### Routing logic

- for `report` mode:
  all specialists run
- for `chat` mode:
  a lightweight router classifies which specialists are needed

That means the agent is more efficient for normal chat than for report
generation.

### Grounding guard

One of the best design details in this repo is the **grounding guard**.

The teacher graph may generate a reply that mentions a score or percentage that
was not actually present in the student's data.

So EduFX does this:

1. generate answer
2. detect invented percentages
3. ask for a correction pass
4. if invented figures still remain, strip those sentences

This makes the teacher safer and more credible for education use.

---

## 5. Student Dossier — The Data Foundation For The Teacher Agent

File:

- [server/app/agents/dossier.py](../../server/app/agents/dossier.py)

This file is extremely important because it is the bridge between raw backend
data and the teacher LLM.

### What it does

It builds a deterministic `StudentDossier` containing:

- student identity
- diagnostic state
- current streak / longest streak
- total sessions
- average quiz score
- average focus
- per-subtopic snapshot
- weak concepts
- behaviour summary

### Why it matters

The dossier means the teacher graph does **not** fetch or derive business logic
for itself.

Instead:

- repositories fetch data
- recommender engine supplies mastery estimates
- rules helpers compute weak concepts
- dossier packages everything into one grounded snapshot

That is a strong architecture choice because it keeps agent prompting separate
from domain computation.

---

## 6. Quiz Self-Check Graph — The Safety Agent

### What it does

This graph exists for one reason:

> Never send a student a question whose marked answer is actually wrong.

That is one of the worst possible education bugs.

So after MCQs are generated, EduFX can run them through
`review_quiz_questions(...)`.

### Flow

```text
QuizService generates questions
  -> quiz_review graph verify node
  -> examiner-style verdicts
  -> keep valid questions
  -> if shortfall and regenerate callback exists
       regenerate replacements
       verify again
  -> final reviewed question set
```

### Important design choice: fail open

If the reviewer:

- is unavailable
- returns invalid JSON
- returns something unusable

the system keeps the original questions instead of silently deleting
everything.

That means the reviewer acts like a **safety net**, not a hard blocker that can
destroy quiz availability.

### Why this is useful in a viva

This is a good engineering talking point:

> We added a reflection-style quality check to reduce answer-key hallucinations
> in generated MCQs, but we designed it to fail open so the app stays usable if
> the reviewer model has a bad response.

---

## 7. Where These Agents Enter The Product

### Scheduling agent

- dashboard daily plan
- post-quiz streak updates

### Teacher agent

- `/teacher/{student_id}/chat`
- `/teacher/{student_id}/report`

### Quiz review agent

- inside quiz generation flow
- before generated questions reach the student

So the agent layer affects:

- planning
- coaching
- reporting
- content quality

not just one screen.

---

## 8. Files To Study

If you want to learn the real agent layer through the code, read in this order.

### First: planning agent

1. [server/app/routes/scheduler.py](../../server/app/routes/scheduler.py)
2. [server/app/controllers/scheduler_controller.py](../../server/app/controllers/scheduler_controller.py)
3. [server/app/services/scheduling_agent.py](../../server/app/services/scheduling_agent.py)
4. [server/app/ml/recommender_engine.py](../../server/app/ml/recommender_engine.py)

### Then: LangGraph teacher agent

5. [server/app/routes/teacher.py](../../server/app/routes/teacher.py)
6. [server/app/controllers/teacher_controller.py](../../server/app/controllers/teacher_controller.py)
7. [server/app/services/teacher_service.py](../../server/app/services/teacher_service.py)
8. [server/app/agents/dossier.py](../../server/app/agents/dossier.py)
9. [server/app/agents/teacher_graph.py](../../server/app/agents/teacher_graph.py)
10. [server/app/agents/prompts.py](../../server/app/agents/prompts.py)

### Then: quiz safety agent

11. [server/app/services/quiz_service.py](../../server/app/services/quiz_service.py)
12. [server/app/agents/quiz_review.py](../../server/app/agents/quiz_review.py)

### Finally: dependency wiring and tests

13. [server/app/core/container.py](../../server/app/core/container.py)
14. [server/tests/unit/test_agents.py](../../server/tests/unit/test_agents.py)

---

## 9. What To Say In A Viva

Short version:

> EduFX has two kinds of agents. First, the deterministic SchedulingAgent turns
> recommender rankings into a realistic daily plan using availability and
> streak rules. Second, the LangGraph agent layer provides an AI teacher and a
> quiz self-check loop. The teacher graph is grounded in a deterministic
> student dossier and uses specialist nodes plus a grounding guard. The quiz
> review graph verifies generated MCQs and optionally regenerates invalid ones.
> This keeps scheduling deterministic while using LLM agents only where they
> add value: coaching and content safety.

---

## 10. One-Line Mental Model

Remember it like this:

> `SchedulingAgent` decides **when and how much** to study,
> the teacher graph explains **how the student is doing**,
> and the quiz review graph checks **whether generated questions are safe to
> trust**.

---

## Source: `docs\getting-started\behaviouraltracking.md`

# EduFX Behavioural Tracking Guide

This document explains how EduFX webcam-based behavioural tracking works, why
it exists, which files implement it, what data gets stored, how focus scores
are calculated, and what was recently improved to make the tracking more
accurate.

It is written as a project-learning guide, so you can use it for development,
debugging, and viva explanations.

## 1. Purpose

EduFX does not use webcam tracking as a punishment system.

It uses webcam tracking to add learning context around a quiz session:

- Was the student focused or frequently distracted?
- Did they leave the frame?
- Was a phone visible often?
- Did the session look drowsy or noisy?
- Should the recommender trust that quiz result as strong evidence of mastery?

This matters because EduFX is behaviour-aware:

- quiz correctness tells us what the student answered
- behavioural tracking tells us how reliable that attempt may have been

So behaviour tracking supports the recommender, progress interpretation, and
session review.

## 2. High-Level Flow

The end-to-end flow is:

1. Student opens the webcam check page.
2. Student chooses `Enable tracking` or `Skip tracking`.
3. Quiz page starts `useWebcamTracker()`.
4. The browser opens the camera and creates an offscreen video stream.
5. `BrowserBehaviourTracker` samples frames during the quiz.
6. `FaceTracker` analyzes facial state using MediaPipe.
7. `PhoneDetector` analyzes whether a phone is visible using TFLite.
8. `FrameQualityAnalyzer` checks whether the frame is dark, overexposed, or blurry.
9. A live focus state is shown on the quiz screen.
10. Snapshot logs are periodically sent to the backend.
11. When the quiz ends, EduFX saves a session summary.
12. The backend recomputes and stores the final behaviour percentages and focus score.

## 3. Main Frontend Files

### Webcam choice and entry

- [webcam-check-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/webcam-check-screen.tsx)
  Lets the student decide whether tracking is enabled before the quiz starts.

### Quiz integration

- [quiz-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/quiz/quiz-screen.tsx)
  Starts and stops webcam tracking for the session and shows the live tracking
  state.

### Webcam hook

- [use-webcam-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/use-webcam-tracker.ts)
  Owns the browser camera stream, the offscreen `<video>`, snapshot timing, and
  final summary save.

### Live orchestrator

- [behaviour-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/behaviour-tracker.ts)
  Coordinates face tracking, phone detection, frame quality checks, smoothing,
  and live focus state updates.

### Face analysis

- [face-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/face-tracker.ts)
  Uses MediaPipe Face Landmarker to detect:
  - face present / absent
  - looking away
  - drowsiness
  - talking
  - multiple persons
  - calibration state

### Phone detection

- [phone-detector.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/phone-detector.ts)
  Uses TensorFlow.js + TFLite to classify whether a phone appears in the frame.

### Frame quality guard

- [frame-quality.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/frame-quality.ts)
  Detects low light, overexposure, and blur so EduFX can soften unreliable
  focus flags.

## 4. Main Backend Files

### Routes

- [behaviour.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/behaviour.py)

Endpoints:

- `POST /behaviour/save-snapshot`
- `POST /behaviour/save-summary`
- `GET /behaviour/session/{session_id}`
- `GET /behaviour/student/{student_id}`

### Service

- [behaviour_service.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/services/behaviour_service.py)

The service is important because the backend is the source of truth:

- it recalculates snapshot focus scores
- it recomputes summary percentages from stored snapshots
- it does not trust client-sent summary numbers blindly

### Shared scoring rules

- [rules.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/core/rules.py)

This contains:

- `calculate_focus_score()`
- `aggregate_behaviour()`

### Shared contracts

- [index.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/shared/contracts/index.ts)

This defines:

- `BehaviourSnapshotPayload`
- `BehaviourSummaryPayload`
- `BehaviourSession`
- `BehaviourHistoryItem`

## 5. What the Frontend Detects

EduFX tracks these behaviour flags per snapshot:

- `face_detected`
- `looking_away`
- `phone_detected`
- `drowsy`
- `multiple_persons`
- `talking`
- `absent`
- `focus_score`

### What each one means

#### `face_detected`

Whether a valid face was detected in the current frame.

#### `absent`

True when the student has been missing from the frame long enough to count as
away. After the recent update, the timeout is shorter and more responsive:

- current absent timeout: about `4 seconds`

#### `looking_away`

True when the face orientation and position suggest the student is not looking
toward the screen.

#### `phone_detected`

True when the phone classifier sees a phone-like object in the frame.

#### `drowsy`

True when the eye and eyelid signals suggest sustained low-alertness, not just
a single blink.

#### `multiple_persons`

True when more than one face is visible.

#### `talking`

True when mouth movement signals suggest the student is talking during the quiz.

## 6. How Face Tracking Works

The face tracker uses MediaPipe landmarks plus derived ratios.

### Core landmark ratios

#### Eye aspect ratio (EAR)

Used to estimate eye openness.

Low EAR over multiple frames can indicate drowsiness.

#### Mouth aspect ratio (MAR)

Used to estimate how open the mouth is.

High MAR over multiple frames can indicate talking.

#### Yaw and pitch

Estimated from face geometry:

- yaw: horizontal head direction
- pitch: vertical head direction

These support `looking_away`.

### Additional signals added in the new version

The improved tracker also uses:

- `eyeClosure`
- `mouthOpen`
- `centerOffsetX`
- `centerOffsetY`

These make the system less dependent on one fragile signal.

## 7. Recent Accuracy Improvements

This is the most important update from the latest behavioural tracking work.

Previously, the tracker depended too much on fixed thresholds like:

- `ear < 0.23`
- `mar > 0.42`
- direct yaw/pitch threshold checks

That caused noisy behavior across different students, lighting conditions, and
camera positions.

The updated system now improves accuracy in five major ways.

### 7.1 Per-session calibration

EduFX now calibrates against the student’s normal face position and natural
resting state at the beginning of the session.

It builds a baseline for:

- EAR
- MAR
- yaw
- pitch
- eye closure
- mouth openness
- face center offset

This means the tracker compares the student against their own normal state,
instead of treating every face exactly the same.

### 7.2 Temporal smoothing

Frame-to-frame values are smoothed using moving updates before behaviour flags
are decided.

This reduces:

- one-frame spikes
- jitter
- false drowsy triggers
- false away triggers

### 7.3 Hysteresis and debounce

EduFX no longer flips behaviour flags on a single frame.

Flags such as:

- drowsy
- talking
- looking away
- multiple persons

now need repeated evidence before activating, and repeated clean evidence before
clearing.

This makes the tracker behave more like a real monitoring system and less like a
frame-by-frame alarm.

### 7.4 Frame quality gating

The new `FrameQualityAnalyzer` checks whether the camera frame is:

- too dark
- too bright
- too blurry

If the frame quality is poor, EduFX softens unreliable focus flags instead of
pretending they are trustworthy.

This is a major practical improvement because webcam errors are often caused by
bad image quality, not model weakness alone.

### 7.5 Smoothed phone detection

Phone detection now uses a stabilized signal instead of trusting one raw model
score at a time.

This reduces:

- brief false positives
- brief false negatives
- noisy phone toggling in the UI

## 8. Live Tracker State in the Quiz UI

The quiz page now exposes a better real-time state.

Important live fields include:

- `focusScore`
- `calibrated`
- `calibrationProgress`
- `quality`
- `warning`

### What the student sees

On the quiz page, the student can now see:

- `Calibrating X%` while baseline building is in progress
- `Focused` when clean conditions are detected
- warning pills such as:
  - `Away`
  - `Phone`
  - `Drowsy`
  - `Looking away`
  - `Multiple people`
  - `Talking`
  - `Quality check`

This makes the UI more honest and easier to understand.

## 9. Camera Input Settings

In [use-webcam-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/use-webcam-tracker.ts),
EduFX now asks the browser for a better input stream:

- facing mode: `user`
- ideal width: `1280`
- ideal height: `720`
- ideal frame rate: `24`
- max frame rate: `30`

This gives the tracker cleaner input than a default low-quality stream.

## 10. Focus Score Formula

Frontend and backend use the same penalty model.

The score starts at `100`.

Penalties:

- `phone_detected` -> `-40`
- `absent` -> `-50`
- `drowsy` -> `-30`
- `looking_away` -> `-20`
- `multiple_persons` -> `-20`
- `talking` -> `-10`

Final rule:

- `focus_score = max(0, score)`

This logic appears in:

- frontend live view:
  [behaviour-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/behaviour-tracker.ts)
- backend source of truth:
  [rules.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/core/rules.py)

## 11. Snapshot and Summary Storage Model

EduFX stores behaviour in two layers.

### Layer 1: snapshots

Snapshots are frequent point-in-time behaviour records during the quiz.

They are sent through:

- `POST /behaviour/save-snapshot`

Payload shape:

```ts
type BehaviourSnapshotPayload = {
  student_id: number;
  session_id: number;
  face_detected: boolean;
  looking_away: boolean;
  phone_detected: boolean;
  drowsy: boolean;
  multiple_persons: boolean;
  talking: boolean;
  absent: boolean;
  focus_score: number;
};
```

Important note:

- the client sends a focus score
- the backend recomputes the real focus score
- the backend does not trust the client value blindly

### Layer 2: session summary

At the end of the quiz, EduFX stores a summary through:

- `POST /behaviour/save-summary`

Payload shape:

```ts
type BehaviourSummaryPayload = {
  student_id: number;
  session_id: number;
  subtopic_id: number;
  webcam_enabled: boolean;
  phone_percent: number;
  drowsy_percent: number;
  away_percent: number;
  talking_percent: number;
  absent_percent: number;
  focus_score: number;
};
```

Important note:

- if tracking is off, focus is stored as `null`
- if tracking is on but no snapshots exist, focus is still stored as `null`
- if snapshots exist, the backend recomputes summary percentages from the logs

## 12. How Summary Percentages Are Computed

The backend uses stored snapshots and calculates:

- `phone_percent`
- `drowsy_percent`
- `away_percent`
- `talking_percent`
- `absent_percent`

Example:

- 10 snapshots
- 4 have `phone_detected = true`

Then:

- `phone_percent = 40`

### Final summary focus score

The summary `focus_score` is not the average of raw numeric scores.

Instead, the backend counts how many snapshots are considered focused:

- focused snapshot = `focus_score >= 80`

Then it calculates the percentage of focused snapshots.

So if 6 out of 10 snapshots are focused:

- final summary `focus_score = 60`

## 13. API and Product Surfaces That Use This Data

Behaviour tracking is visible in multiple places.

### Quiz page

- live status pills
- live focus score
- calibration and quality messages

### Results page

- focus-related summary for the finished session

### Behaviour logs page

- history of tracked sessions

### Admin views

- average focus metrics
- student session review

### Recommender context

Behaviour data gives learning context to the adaptive system, especially when
interpreting whether a quiz result reflects true understanding or distracted
performance.

## 14. Privacy Model

Current UX messaging is privacy-aware:

- tracking is optional
- students can skip tracking
- the system stores behaviour signals and summary values, not raw webcam video

That matters for ethics, user trust, and viva discussion.

## 15. Current Strengths

The current behavioural tracker is now much better than the original version
because it has:

- real face landmark analysis
- real phone classification
- calibration
- smoothing
- hysteresis
- frame quality checks
- backend recomputation for trustworthiness
- optional participation

This is a solid browser-based behavioural tracking design for an academic
project.

## 16. Current Limitations

Even after the improvements, it still has limitations.

### Browser limitations

- all tracking is still running in the browser tab
- heavy inference can affect responsiveness on weak devices

### Camera limitations

- side angles can still reduce accuracy
- glasses, low light, and poor webcams can still reduce quality

### Behaviour interpretation limitations

- looking away does not always mean distraction
- talking may be false when reading aloud
- drowsiness is only an estimate, not a medical judgement

These are normal limitations and good to mention in a viva.

## 17. Best Next Technical Upgrades

If you want to push this system further, these are the best next upgrades.

### 17.1 Move inference work off the main UI thread

The browser tab currently handles UI plus webcam inference.

A stronger design would move tracking work into a worker-style pipeline so quiz
interaction stays smoother.

### 17.2 Add posture or upper-body cues

Right now, most behaviour inference is face-centric.

Adding body posture cues could improve:

- looking away detection
- absence confidence
- suspicious movement patterns

### 17.3 Add gaze-specific modelling

Current `looking_away` is based on face geometry and center offsets.

A more advanced gaze model could improve accuracy further.

### 17.4 Personal threshold tuning

The new calibration already helps, but a longer personalization window could
further improve:

- blink tolerance
- mouth movement tolerance
- natural resting head angle tolerance

### 17.5 Session analytics for evaluation

To evaluate tracking quality properly, create labeled test sessions such as:

- focused student
- student using phone
- student frequently looking away
- low light session
- blurry camera session

Then compare tracker outputs against expected labels.

That would turn behaviour tracking from a working feature into a measurable ML
subsystem.

## 18. Good Viva Explanation

If someone asks, “How does the behavioural tracking work?”, a strong answer is:

> EduFX runs optional browser-side webcam analysis during quizzes. The frontend
> uses MediaPipe face landmarks for face presence, away detection, drowsiness,
> talking, and multi-person checks, and a TensorFlow Lite model for phone
> detection. The latest version improves accuracy using per-session calibration,
> temporal smoothing, hysteresis, and frame-quality checks for blur and
> lighting. Snapshot logs are sent to the backend, which recomputes focus scores
> and aggregates final behaviour percentages per session. This behavioural
> signal is then used as context for interpreting quiz performance in the
> adaptive learning system.

## 19. Key Takeaway

The behavioural tracking system is not just “camera on/off”.

It is a full pipeline with:

- browser camera capture
- real-time inference
- signal stabilization
- API persistence
- backend recomputation
- session summary aggregation
- product UI integration
- adaptive-learning relevance

That makes it one of the important intelligent subsystems inside EduFX.

---

## Source: `docs\getting-started\session-handoff.md`

# EduFX Session Handoff

> Last reconciled with source and production: 2026-09-10.
> Start with [Current status and roadmap](../current-status-and-roadmap.md).

## Project

EduFX is an adaptive A-Level Chemistry platform for ten S-block subtopics.

| Layer | Current implementation |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | FastAPI, Python, layered controllers/services/repositories |
| Database | Supabase PostgreSQL and pgvector-compatible content storage |
| Authentication | Supabase Google OAuth and email/password |
| Production text AI | Groq |
| Production retrieval | Supabase chunks with lexical ranking |
| Recommendation | DKT, then BKT, then deterministic rules |
| Hosting | Azure Container Apps and Azure Container Registry |
| Deployment | GitHub Actions on pushes to `main` |

Repository: `https://github.com/thanoban/EduFX.git`

## Production

- Frontend: `https://edufx-frontend.victorioussand-12db2490.centralindia.azurecontainerapps.io`
- Backend: `https://edufx-backend.victorioussand-12db2490.centralindia.azurecontainerapps.io`
- Swagger: `https://edufx-backend.victorioussand-12db2490.centralindia.azurecontainerapps.io/docs`
- Verified production commit: `b3905a0`

The Azure workflow uses `AI_PROVIDER_ORDER=groq`, disables Vertex, does not
inject Gemini, and scales both apps to zero when idle.

## Current User Journey

```text
sign in
  -> self-assessment
  -> diagnostic
  -> results
  -> availability
  -> dashboard recommendation
  -> study
  -> optional webcam check
  -> quiz
  -> results and explanation
  -> updated progress and next plan
```

The diagnostic questions endpoint is protected. `401` without a bearer token
is the intended production result, not a failure.

## Current Feature State

### Working

- Supabase sign-in and callback restoration
- student-scoped API authorization and ownership checks
- diagnostic self-assessment, 40 questions, and level assignment
- availability setup and per-day session length
- DKT/BKT-backed ranking with deterministic fallback
- recommendation-gated content and quiz routes
- Groq text generation with deterministic route fallbacks
- lexical RAG over Supabase chemistry chunks
- quiz review and teacher graph orchestration
- optional browser-side behaviour tracking
- progress, behaviour history, and admin views
- Azure deployment and production smoke checks

### Optional

- QLoRA quiz endpoint through `FINETUNED_MODEL_URL`
- Gemini or Vertex text/embedding providers outside the current Azure workflow
- in-memory backend for local tests and demonstrations

### Removed

Daily email reminders, their internal API route, and their scheduled GitHub
workflow were removed. Availability-based scheduling remains.

## Important Rules

1. Never commit `.env`, cloud credentials, Supabase service keys, or AI keys.
2. Use the Supabase anon/publishable key only in `NEXT_PUBLIC_*` variables.
3. Keep service-role and JWT secrets backend-only.
4. Treat GCP, Vertex, AWS, and model-hosting guides as optional or historical.
5. Do not describe DKT `0.6822` ROC-AUC as real-student accuracy; it came from
   held-out synthetic sequences.
6. Do not describe the six-record QLoRA dataset as production-quality training.
7. Do not restore reminders without consent, unsubscribe, provider, and delivery
   observability.

## Architecture Boundary

```text
Route -> Controller -> Service/Agent -> Repository -> Supabase or memory store
```

- Routes own HTTP parsing and authorization dependencies.
- Controllers translate API calls into service calls.
- Services enforce product rules.
- Agents coordinate multi-step decisions.
- Repositories own persistence.
- BKT/DKT rank learning needs; they do not send emails or choose session size.
- `SchedulingAgent` applies availability and plan-size constraints.

## Key Files

| File | Purpose |
|---|---|
| `server/app/core/application.py` | FastAPI routes, middleware, health endpoints |
| `server/app/core/request_auth.py` | authentication and student ownership checks |
| `server/app/core/container.py` | dependency wiring |
| `server/app/services/ai_service.py` | Groq/Gemini/Vertex and optional fine-tune selection |
| `server/app/ml/recommender_engine.py` | DKT/BKT/rules candidate ranking |
| `server/app/services/scheduling_agent.py` | availability and daily plan composition |
| `server/app/rag/retriever.py` | vector or lexical chunk ranking |
| `server/app/agents/teacher_graph.py` | grounded teacher orchestration |
| `server/app/agents/quiz_review.py` | generated quiz review loop |
| `client/src/features/auth/auth-provider.tsx` | browser session lifecycle |
| `client/src/features/diagnostic/` | onboarding and diagnostic screens |
| `client/src/features/dashboard/dashboard-screen.tsx` | recommended daily plan |
| `client/src/features/webcam/` | browser-side behaviour signals |
| `.github/workflows/test.yml` | backend and frontend CI |
| `.github/workflows/deploy-azure.yml` | current production deployment |

## Local Environment

Backend essentials:

```dotenv
DATA_BACKEND=supabase
DEMO_MODE=false
FRONTEND_ORIGIN=http://localhost:3000
SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
AI_PROVIDER_ORDER=groq
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
VERTEX_AI_ENABLED=false
```

Frontend essentials:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SKIP_LOGIN=false
```

## Verification

```powershell
Set-Location D:\PROJECTS\2ndYearProject\EduFX_MVC\server
python -m pytest tests -v

Set-Location D:\PROJECTS\2ndYearProject\EduFX_MVC\client
npx tsc --noEmit
npx vitest run
npm run build
```

The deployment workflow additionally requires:

- frontend `/diagnostic/availability` -> `200`
- anonymous backend `/diagnostic/questions` -> `401`
- removed backend `/internal/reminders/run` -> `404`

## Immediate Plan

1. Disable `demo:` tokens in production.
2. Restrict CORS to exact approved origins.
3. Add authenticated deployed tests and a staging environment.
4. Add provider latency/error observability.
5. Evaluate hybrid retrieval and DKT on labelled, real-world data.

The detailed plan and release rules are maintained in
[Current status and roadmap](../current-status-and-roadmap.md).

---

## Source: `docs\index.md`

# EduFX Docs

This folder is now organized by purpose instead of keeping every `.md` file in
one flat list.

## Start Here

- [Current status and roadmap](current-status-and-roadmap.md)
  Authoritative production URLs, verified behavior, working/optional/removed
  features, known limitations, and the prioritized delivery plan.
- [Full adaptive-system guide](getting-started/adaptive-system-learning-guide.md)
  Beginner-friendly guide to the whole adaptive system: recommender, agent,
  fine-tune, RAG, metrics, and backend integration.
- [Architecture reference](architecture/architecture-reference.md)
  System architecture notes, key backend patterns, and module boundaries.
- [Feature guides index](features/index.md)
  Feature-by-feature breakdown of authentication, diagnostic, scheduler,
  content, quiz, results, tracking, progress, settings, and admin flows.
- [Agent learning guide](getting-started/agent-learning-guide.md)
  Agent-only walkthrough: scheduling flow, files, data path, and integration.
- [Behavioural tracking guide](getting-started/behaviouraltracking.md)
  End-to-end webcam tracking guide: live inference, focus scoring, backend
  aggregation, and accuracy improvements.
- [Session handoff](getting-started/session-handoff.md)
  Current project state, architecture, env vars, and key files.

## Architecture

- [Architecture reference](architecture/architecture-reference.md)
  Repo structure, MVC layering, contracts, and local run notes.

## Plans

- [Current status and roadmap](current-status-and-roadmap.md)
  The active product, security, reliability, AI, ML, and QA plan.
- [Recommender implementation plan](plans/recommender-implementation-plan.md)
  Historical implementation design plus BKT/DKT training detail. The models
  and backend integration are now implemented.

## ML Recommender

- [Recommender learning basics](ml-recommender/recommender-learning-basics.md)
  Slow explanation from simulator to backend integration.
- [Recommender Colab training](ml-recommender/recommender-colab-training.md)
  Runnable Colab notebook guide for BKT and DKT training.

## Fine-Tuning

- [Fine-tune results](finetuning/finetune-results.md)
  Measured training metrics and saved adapter artifacts.
- [Fine-tune method](finetuning/finetune-method.md)
  QLoRA method in plain language and viva reasoning.
- [Fine-tune Colab guide](finetuning/finetune-colab-guide.md)
  Full Colab notebook path that actually worked.
- [Dataset format](finetuning/finetune-dataset-format.md)
  JSONL contract and validation expectations.
- [Fine-tune + RAG plan](finetuning/finetune-rag-data-plan.md)
  Why both fine-tune and RAG are needed.
- [Vertex tuning plan](finetuning/finetune-vertex-plan.md)
  Historical/optional managed-tuning path; not current production.
- [AWS hosting guide](finetuning/finetune-aws-hosting-guide.md)
  Optional hosting reference; not current production.
- [Azure hosting guide](finetuning/finetune-azure-hosting-guide.md)
  Optional fine-tuned GPU hosting reference; no endpoint is active in current
  production.

## Deployment

- [Deployment plan](deployment/deployment-plan.md)
  Archived/manual GCP recovery notes; not the active deployment plan.
- [Azure production deployment](deployment/azure-production.md)
  Current Groq-first production path, Azure Container Apps setup,
  GitHub OIDC, production secrets, verification, cost controls, and rollback.

## Data

- [Data format guide](data/data-format-guide.md)
  How to write RAG notes and fine-tune JSONL data.

## QA

- [QA documentation index](qa/index.md)
  Test planning, test cases, bug reports, QA summary reports, and API
  validation guidance.
- [QA project structure](qa/qa-project-structure.md)
  Recommended mini-project layout for professional QA portfolios.
- [Test plan](qa/test-plan.md)
- [Test cases](qa/test-cases.md)
- [Bug report samples](qa/bug-report-samples.md)
- [QA summary report](qa/qa-summary-report.md)
- [API testing checklist](qa/api-testing-checklist.md)
- [API testing guide (manual, endpoint-by-endpoint)](qa/api-testing-guide.md)
- [Automated API testing guide](qa/automated-api-testing-guide.md)
- [Postman collection](qa/api-testing/edufx-api.postman_collection.json)
- [Exploratory charter](qa/manual-testing/exploratory-charter.md)

## Product and UI

- [UI details](product/ui-details.md)
  UI component map and page-by-page layout.
- [Landing page plan](product/landing-page-plan.md)
  From-scratch content, visual direction, image guidance, responsive contract,
  implementation stages, and acceptance criteria.

## Feature Guides

- [Feature guides index](features/index.md)
  Start here for focused documentation per EduFX feature.
- [Authentication and session management](features/authentication-and-session-management.md)
- [Diagnostic and level assignment](features/diagnostic-and-level-assignment.md)
- [Dashboard and adaptive scheduler](features/dashboard-and-adaptive-scheduler.md)
- [Study content and level-aware notes](features/study-content-and-level-aware-notes.md)
- [Quiz and session flow](features/quiz-and-session-flow.md)
- [Results and AI explanations](features/results-and-ai-explanations.md)
- [Behavioural tracking](getting-started/behaviouraltracking.md)
- [Progress tracking](features/progress-tracking.md)
- [Settings and availability](features/settings-and-availability.md)
- [Admin analytics and student management](features/admin-analytics-and-student-management.md)

## Recommended Reading Order

1. [current-status-and-roadmap.md](current-status-and-roadmap.md)
2. [architecture/architecture-reference.md](architecture/architecture-reference.md)
3. [features/index.md](features/index.md)
4. [getting-started/adaptive-system-learning-guide.md](getting-started/adaptive-system-learning-guide.md)
5. [getting-started/behaviouraltracking.md](getting-started/behaviouraltracking.md)
6. [getting-started/agent-learning-guide.md](getting-started/agent-learning-guide.md)
7. [ml-recommender/recommender-learning-basics.md](ml-recommender/recommender-learning-basics.md)
8. [finetuning/finetune-method.md](finetuning/finetune-method.md)
9. [finetuning/finetune-results.md](finetuning/finetune-results.md)
10. [deployment/azure-production.md](deployment/azure-production.md)
11. [qa/index.md](qa/index.md)

## Historical Records

The dated QA summary, Colab notebooks, model-hosting alternatives, and GCP
deployment plan document what was tested or considered at that time. They are
valuable evidence, but they do not override the current status page.

---

## Source: `docs\ml-recommender\recommender-colab-training.md`

# EduFX Recommender — Full Model Training in Google Colab

This is a **self-contained training notebook in markdown form** for the *complete*
EduFX recommender. Paste each cell into a fresh Google Colab notebook, top to
bottom, and run. You will train **both** knowledge-tracing models — the classic
**BKT** baseline and the deep **DKT** model — compare them head-to-head, and
download the artifacts the backend loads.

Nothing needs to be uploaded from the repo — every cell is complete on its own.
The model architectures match `server/app/ml/bkt.py` and `server/app/ml/dkt.py`
exactly, so the artifacts you export load and run in the FastAPI backend
unchanged.

---

## What you're training and why

EduFX's backend currently recommends the next subtopic with a hand-tuned rule
(`days_since_studied × level_multiplier`). It works, but it can't *learn* from
data, can't tell that mastering **G1 thermal stability** makes **G2 thermal
stability** easier, and treats a quiz passed while distracted the same as one
passed while focused.

**Knowledge Tracing (KT)** is the standard ML framing for "what should this
student study next": from a student's history of `(subtopic, correct/incorrect,
focus)` interactions, estimate the probability they've mastered each subtopic,
then recommend from those estimates. You'll build two KT models:

| Model | What it is | Strength |
|---|---|---|
| **BKT** | One 2-state Hidden Markov Model per subtopic, 4 interpretable params, fit with Expectation-Maximization (pure numpy) | Fully explainable baseline |
| **DKT** | One shared LSTM across all subtopics (PyTorch) | Learns cross-topic transfer BKT can't |

Building the classic baseline *and* the deep model, then measuring which wins, is
the strongest possible story — you demonstrate you understand the fundamentals
and the deep model, with numbers to back it.

**Why Colab / no GPU needed:** you're doing this hands-on to learn. Both models
are tiny — BKT is instant, DKT is ~23k parameters and trains on Colab's CPU in
about a minute.

---

## Notebook name and runtime

Recommended notebook name (File → Rename in Colab):

`EduFX_Recommender_Guide_BKT_DKT`

Runtime: **CPU only** is enough (Runtime → Change runtime type → CPU). A GPU is
not required — DKT trains in under a minute either way.

---

## Cell 1 — Install

**What & why.** Three libraries only. `torch` builds and trains the LSTM (DKT).
`numpy` handles arrays, all of BKT, and the CPU inference the server uses.
`scikit-learn` gives us `roc_auc_score` for the comparison. `torch` is a
**training-only** dependency — the EduFX backend never imports it (BKT is numpy;
DKT is served from exported numpy weights).

```python
!pip -q install torch numpy scikit-learn
print("installed")
```

---

## Cell 2 — Config & the skill map

**What & why.** Our "skills" are the 10 S-block subtopics. The **prerequisite
graph** encodes which subtopics build on which — e.g. skill 7 (G2 thermal
stability) depends on skill 6 (G2 reactions) and is *primed* by skill 2 (G1
thermal stability, which teaches the same "polarizing power" idea). This
cross-topic structure is what the deep model (DKT) learns to exploit and what BKT
and the old flat heuristic are blind to.

```python
import numpy as np

NUM_SKILLS = 10
SKILL_LABELS = {
    0: "G1 · Group trends", 1: "G1 · Reactions",     2: "G1 · Thermal stability",
    3: "G1 · Solubility",   4: "G1 · Flame tests",
    5: "G2 · Group trends", 6: "G2 · Reactions",     7: "G2 · Thermal stability",
    8: "G2 · Solubility",   9: "G2 · Flame tests",
}

# skill -> list of (prerequisite_skill, strength 0..1)
# strength >= 0.6 = hard prerequisite (gates recommendation);
# weaker links = cross-group "priming" (a learning boost, not a blocker).
PREREQUISITES = {
    0: [],                    1: [(0, 1.0)],           2: [(1, 1.0)],
    3: [(1, 1.0)],            4: [(1, 1.0)],
    5: [(0, 0.4)],            6: [(5, 1.0), (1, 0.4)], 7: [(6, 1.0), (2, 0.4)],
    8: [(6, 1.0), (3, 0.4)],  9: [(6, 1.0), (4, 0.4)],
}
print("skills:", NUM_SKILLS)
```

---

## Cell 3 — The student simulator (synthetic training data)

**What & why.** Deep KT needs *thousands* of student histories; EduFX doesn't
have that many real students yet. So we hand-write a small **generative model of
learning** and sample virtual students — a standard, legitimate way to prototype
(and a great way to understand what the models must recover).

Three ingredients: (1) each student has a hidden per-skill **ability** (`theta`)
that starts low and grows with practice; (2) **answering** follows a logistic
item-response curve with slip/guess so it behaves like a real 4-option MCQ; (3)
**focus** varies per attempt — low focus hurts the answer and slows learning.
Mastered prerequisites boost effective ability, which is the cross-topic transfer
DKT should discover. We generate **3,000 students (~150k interactions)**.

```python
from dataclasses import dataclass

_DISCRIMINATION = 1.7    # steepness of the correctness curve
_SLIP  = 0.10            # P(wrong | fully mastered)
_GUESS = 0.25            # P(right | no idea) — 4-option MCQ
_LEARN_RATE   = 0.85     # ability gained per focused practice
_PREREQ_BOOST = 0.9      # lift from mastered prerequisites
_START_THETA  = -1.8     # ability floor before practice
_THETA_CEILING = 3.5     # mastery asymptote

def _sigmoid(x): return 1.0 / (1.0 + np.exp(-x))

@dataclass(frozen=True)
class Interaction:
    skill: int
    correct: int
    focus: float     # recorded focus (1.0 if not tracked — see Cell 6)
    tracked: int     # 1 = webcam focus measured, 0 = student skipped tracking

class _SimStudent:
    def __init__(self, rng):
        aptitude = rng.normal(0.0, 0.7)
        self.theta = np.full(NUM_SKILLS, _START_THETA) + aptitude + rng.normal(0, 0.4, NUM_SKILLS)
        self.focus_mean   = float(rng.uniform(0.35, 0.95))
        self.focus_spread = float(rng.uniform(4.0, 10.0))
        self.uses_tracking = rng.random() < 0.7   # ~70% of students keep tracking on
        self._rng = rng

    def sample_focus(self):
        a = self.focus_mean * self.focus_spread
        b = (1 - self.focus_mean) * self.focus_spread
        return float(np.clip(self._rng.beta(a, b), 0.02, 1.0))

    def effective_theta(self, s):
        t = self.theta[s]
        for p, strength in PREREQUISITES.get(s, []):
            t += _PREREQ_BOOST * strength * _sigmoid(self.theta[p])
        return t

    def p_correct(self, s, focus):
        z = _DISCRIMINATION * (self.effective_theta(s) - 0.0)
        base = _GUESS + (1 - _GUESS - _SLIP) * _sigmoid(z)
        distraction = 1.0 - focus
        return float((1 - 0.5 * distraction) * base + 0.5 * distraction * _GUESS)

    def study(self, s, focus):
        headroom = _THETA_CEILING - self.theta[s]
        self.theta[s] += _LEARN_RATE * focus * _sigmoid(headroom)

def _choose_next_skill(st, rng):
    if rng.random() < 0.2:
        return int(rng.integers(NUM_SKILLS))               # exploration
    unlocked = [s for s in range(NUM_SKILLS)
                if all(_sigmoid(st.theta[p]) >= 0.5
                       for p, strg in PREREQUISITES.get(s, []) if strg >= 0.6)]
    if not unlocked:
        unlocked = [0]
    return min(unlocked, key=lambda s: st.theta[s])        # weakest unlocked

def simulate_student(rng, min_len=30, max_len=80):
    st = _SimStudent(rng)
    L = int(rng.integers(min_len, max_len + 1))
    hist = []
    for _ in range(L):
        s = _choose_next_skill(st, rng)
        true_focus = st.sample_focus()          # physically always exists
        correct = int(rng.random() < st.p_correct(s, true_focus))
        st.study(s, true_focus)                 # learning uses the REAL focus
        if st.uses_tracking:
            rec_focus, tracked = round(true_focus, 3), 1
        else:
            rec_focus, tracked = 1.0, 0          # not measured -> neutral / full credit
        hist.append(Interaction(s, correct, rec_focus, tracked))
    return hist

def simulate_dataset(n_students=3000, seed=42, min_len=30, max_len=80):
    rng = np.random.default_rng(seed)
    return [simulate_student(rng, min_len, max_len) for _ in range(n_students)]

data = simulate_dataset(3000, seed=42)
train_data, val_data = data[:2400], data[2400:]   # 80/20 split
_all = [(i.focus, i.correct) for s in data for i in s if i.tracked]
_f = np.array([a for a, _ in _all]); _c = np.array([b for _, b in _all])
print(f"students={len(data)}  interactions={sum(len(s) for s in data)}")
print(f"focus (tracked only): hi={_c[_f>=0.7].mean():.3f} lo={_c[_f<0.4].mean():.3f}")
```

Expected: ~3000 students, ~165k interactions, focus hi≈0.59 vs lo≈0.42 (focus
helps — a signal the models must recover).

---

# PART A — BKT (the classic, interpretable baseline)

## Cell 4 — BKT: model, EM fitting, behaviour-aware inference

**What & why.** For *each skill*, BKT is a 2-state Hidden Markov Model: the hidden
state is "learned" or "not learned", and four parameters describe it —
`L0` (prior known), `T` (learn rate), `S` (slip: wrong despite knowing),
`G` (guess: right despite not knowing). We fit them with **Expectation-
Maximization** (the Baum-Welch forward-backward algorithm). Every number is
interpretable — that's BKT's whole appeal.

**Behaviour-aware:** focus is folded in at *inference*. When updating the mastery
belief after an answer, low focus inflates the effective slip/guess toward 0.5,
so a distracted answer barely moves the belief. A skipped-tracking session
(`focus=1.0`) simply gets no discount — never penalized.

```python
from dataclasses import dataclass as _dc

_MIN_P, _MAX_P = 0.01, 0.99
_MAX_SLIP, _MAX_GUESS = 0.30, 0.40

@_dc
class BKTParams:
    p_L0: float; p_T: float; p_S: float; p_G: float

def _emission(obs, slip, guess):
    if obs == 1:  # correct
        return guess, 1.0 - slip          # P(obs | not-learned), P(obs | learned)
    return 1.0 - guess, slip              # wrong

def _forward_backward(obs, prm):
    T = len(obs)
    pi = np.array([1.0 - prm.p_L0, prm.p_L0])
    A  = np.array([[1.0 - prm.p_T, prm.p_T], [0.0, 1.0]])   # "known" is absorbing
    alpha = np.zeros((T, 2)); scale = np.zeros(T)
    b0, b1 = _emission(int(obs[0]), prm.p_S, prm.p_G)
    alpha[0] = pi * np.array([b0, b1]); scale[0] = alpha[0].sum() or 1e-12; alpha[0] /= scale[0]
    for t in range(1, T):
        b0, b1 = _emission(int(obs[t]), prm.p_S, prm.p_G)
        alpha[t] = (alpha[t-1] @ A) * np.array([b0, b1])
        scale[t] = alpha[t].sum() or 1e-12; alpha[t] /= scale[t]
    beta = np.zeros((T, 2)); beta[-1] = 1.0
    for t in range(T-2, -1, -1):
        b0, b1 = _emission(int(obs[t+1]), prm.p_S, prm.p_G)
        beta[t] = (A @ (np.array([b0, b1]) * beta[t+1])) / scale[t+1]
    gamma = alpha * beta; gamma /= gamma.sum(axis=1, keepdims=True) + 1e-12
    xi = np.zeros(T-1)
    for t in range(T-1):
        b0, b1 = _emission(int(obs[t+1]), prm.p_S, prm.p_G)
        xi[t] = alpha[t, 0] * prm.p_T * b1 * beta[t+1, 1] / (scale[t+1] + 1e-12)
    return gamma, xi

def _fit_skill(sequences, iters=60):
    prm = BKTParams(0.2, 0.15, 0.1, 0.25)
    for _ in range(iters):
        l0n=l0d=tn=td=sn=sd=gn=gd=0.0
        for obs in sequences:
            if len(obs) == 0: continue
            gamma, xi = _forward_backward(obs, prm)
            l0n += gamma[0, 1]; l0d += 1.0
            if len(obs) > 1:
                tn += xi.sum(); td += gamma[:-1, 0].sum()
            wrong = (obs == 0).astype(float); right = (obs == 1).astype(float)
            sn += (gamma[:, 1] * wrong).sum(); sd += gamma[:, 1].sum()
            gn += (gamma[:, 0] * right).sum(); gd += gamma[:, 0].sum()
        prm = BKTParams(
            float(np.clip(l0n/(l0d+1e-12), _MIN_P, _MAX_P)),
            float(np.clip(tn/(td+1e-12),  _MIN_P, _MAX_P)),
            float(np.clip(sn/(sd+1e-12),  _MIN_P, _MAX_SLIP)),
            float(np.clip(gn/(gd+1e-12),  _MIN_P, _MAX_GUESS)))
    return prm

def _focus_adjust(prm, focus):
    d = 1.0 - float(np.clip(focus, 0.0, 1.0))     # distraction
    return prm.p_S + d*(0.5 - prm.p_S), prm.p_G + d*(0.5 - prm.p_G)

class BKTModel:
    def __init__(self, params=None): self.params = params or {}

    @classmethod
    def fit(cls, dataset):
        per_skill = {s: [] for s in range(NUM_SKILLS)}
        for seq in dataset:
            buckets = {s: [] for s in range(NUM_SKILLS)}
            for it in seq: buckets[it.skill].append(it.correct)
            for s, obs in buckets.items():
                if obs: per_skill[s].append(np.array(obs, dtype=np.int64))
        m = cls()
        for s in range(NUM_SKILLS): m.params[s] = _fit_skill(per_skill[s])
        return m

    def belief_after(self, obs, focus, skill):
        """Online forward filter -> P(learned) after this skill's sub-history."""
        p = self.params[skill]; belief = p.p_L0
        for o, f in zip(obs, focus):
            slip, guess = _focus_adjust(p, f)
            lk, lu = (1.0-slip, guess) if o == 1 else (slip, 1.0-guess)
            post = belief*lk / (belief*lk + (1.0-belief)*lu + 1e-12)
            belief = post + (1.0-post)*p.p_T
        return float(belief)

    def predict_mastery(self, history):
        obs = {s: [] for s in range(NUM_SKILLS)}; foc = {s: [] for s in range(NUM_SKILLS)}
        for it in history:
            obs[it.skill].append(it.correct); foc[it.skill].append(it.focus)
        return {s: (self.belief_after(obs[s], foc[s], s) if obs[s] else self.params[s].p_L0)
                for s in range(NUM_SKILLS)}

    def predict_p_correct(self, history):
        m = self.predict_mastery(history)
        return {s: m[s]*(1.0-self.params[s].p_S) + (1.0-m[s])*self.params[s].p_G
                for s in range(NUM_SKILLS)}
```

---

## Cell 5 — Fit BKT and read the parameters

**What & why.** BKT fits in a second (pure numpy, no GPU). Print the learned
parameters — you can defend each one in a viva ("this skill's guess ≈ 0.27, close
to the 0.25 you'd expect from a 4-option MCQ").

```python
bkt = BKTModel.fit(train_data)
print("Fitted BKT parameters per skill:")
for s in range(NUM_SKILLS):
    p = bkt.params[s]
    print(f"  {s} {SKILL_LABELS[s]:<22} L0={p.p_L0:.3f} T={p.p_T:.3f} S={p.p_S:.3f} G={p.p_G:.3f}")

# behaviour-aware sanity check
drill_focused    = [Interaction(4, 1, 0.95, 1) for _ in range(7)]
drill_distracted = [Interaction(4, 1, 0.15, 1) for _ in range(7)]
drill_untracked  = [Interaction(4, 1, 1.00, 0) for _ in range(7)]
print("\nmastery[4]  focused =%.3f  distracted =%.3f  untracked =%.3f (=focused, no penalty)"
      % (bkt.predict_mastery(drill_focused)[4],
         bkt.predict_mastery(drill_distracted)[4],
         bkt.predict_mastery(drill_untracked)[4]))
```

Expected: `L0` low (students start not-knowing), `G ≈ 0.27` (near the 0.25 guess
floor), and focused ≈ distracted-is-lower ≈ untracked-matches-focused.

---

# PART B — DKT (the deep model)

## Cell 6 — Input encoding: behaviour-aware, tracking optional

**What & why.** DKT reads one vector per interaction. The first `2K` slots are the
classic DKT encoding: a one-hot of the skill in the *first* half if correct, the
*second* half if wrong. Then two behaviour slots: `focus` (0–1) and `tracked`
(1 measured, 0 skipped). A skipped session is `focus=1.0, tracked=0` — full
credit, never penalized — and the separate `tracked` bit lets the network tell
"fully focused" apart from "not measured".

```python
INPUT_DIM = 2 * NUM_SKILLS + 2   # 2K one-hot(skill*correct) + focus + tracked

def encode_step(skill, correct, focus, tracked):
    v = np.zeros(INPUT_DIM, dtype=np.float32)
    if correct: v[skill] = 1.0
    else:       v[NUM_SKILLS + skill] = 1.0
    v[2 * NUM_SKILLS]     = float(np.clip(focus, 0.0, 1.0))
    v[2 * NUM_SKILLS + 1] = float(tracked)
    return v

print("input dim:", INPUT_DIM)
```

---

## Cell 7 — The DKT model (PyTorch LSTM)

**What & why.** One shared LSTM reads the sequence; at each step its hidden state
feeds a linear head that outputs one logit per skill → sigmoid →
`P(next answer on that skill is correct)`. Because one network sees all skills, it
learns cross-topic transfer BKT structurally cannot.

```python
import torch
import torch.nn as nn

HIDDEN_DIM = 64

class DKT(nn.Module):
    def __init__(self, input_dim=INPUT_DIM, hidden=HIDDEN_DIM, num_skills=NUM_SKILLS):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden, batch_first=True)
        self.head = nn.Linear(hidden, num_skills)
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.head(out)             # (batch, seq, num_skills) logits

print(DKT())
```

---

## Cell 8 — Train DKT (masked next-step prediction)

**What & why.** Objective: **predict the next answer**. At step *t* the model's
prediction for the skill attempted at *t+1* is scored against the actual result
with binary cross-entropy; we supervise only the attempted skill (gather) and
**mask** padding. Adam optimizes; loss should fall steadily.

```python
def build_tensors(dataset):
    xs, sks, ys = [], [], []
    for seq in dataset:
        if len(seq) < 2: continue
        x  = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in seq[:-1]])
        sk = np.array([i.skill   for i in seq[1:]], dtype=np.int64)
        y  = np.array([i.correct for i in seq[1:]], dtype=np.float32)
        xs.append(x); sks.append(sk); ys.append(y)
    maxlen = max(len(x) for x in xs); B = len(xs)
    X  = np.zeros((B, maxlen, INPUT_DIM), np.float32); SK = np.zeros((B, maxlen), np.int64)
    Y  = np.zeros((B, maxlen), np.float32);            M  = np.zeros((B, maxlen), np.float32)
    for i, (x, sk, y) in enumerate(zip(xs, sks, ys)):
        L = len(x); X[i, :L] = x; SK[i, :L] = sk; Y[i, :L] = y; M[i, :L] = 1.0
    return (torch.from_numpy(X), torch.from_numpy(SK), torch.from_numpy(Y), torch.from_numpy(M))

def train_dkt(dataset, epochs=20, batch=32, lr=1e-2, seed=0):
    torch.manual_seed(seed)
    model = DKT(); opt = torch.optim.Adam(model.parameters(), lr=lr)
    bce = nn.BCEWithLogitsLoss(reduction="none")
    X, SK, Y, M = build_tensors(dataset); n = X.shape[0]
    for ep in range(epochs):
        perm = torch.randperm(n); tot = 0.0
        for s in range(0, n, batch):
            idx = perm[s:s+batch]; xb, skb, yb, mb = X[idx], SK[idx], Y[idx], M[idx]
            pred = model(xb).gather(2, skb.unsqueeze(-1)).squeeze(-1)
            loss = (bce(pred, yb) * mb).sum() / mb.sum()
            opt.zero_grad(); loss.backward(); opt.step()
            tot += float(loss) * len(idx)
        print(f"epoch {ep+1:2d}/{epochs}  loss={tot/n:.4f}")
    return model

dkt = train_dkt(train_data)
```

---

# PART C — Compare, then export

## Cell 9 — Evaluate BKT vs DKT vs a baseline (held-out ROC-AUC)

**What & why.** The fair, honest test: on students neither model trained on, how
well does each one's predicted `P(correct)` rank actual correct-vs-wrong answers?
Same protocol for both — at every step predict the next attempt using only the
history so far. **ROC-AUC**: 0.5 = coin flip, 1.0 = perfect. We also include the
trivial "always predict the base rate" majority baseline as a floor. This table
is your viva evidence.

```python
from sklearn.metrics import roc_auc_score

@torch.no_grad()
def dkt_auc(model, dataset):
    yt, yp = [], []
    for seq in dataset:
        if len(seq) < 2: continue
        x = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in seq[:-1]])
        probs = torch.sigmoid(model(torch.from_numpy(x).unsqueeze(0))[0]).numpy()
        for t, nxt in enumerate(seq[1:]):
            yt.append(nxt.correct); yp.append(probs[t, nxt.skill])
    return roc_auc_score(yt, yp), yt

def bkt_auc(model, dataset):
    yt, yp = [], []
    for seq in dataset:
        # online: maintain per-skill belief; predict next BEFORE seeing its answer
        obs = {s: [] for s in range(NUM_SKILLS)}; foc = {s: [] for s in range(NUM_SKILLS)}
        for i, it in enumerate(seq):
            if i > 0:  # predict this step from history so far
                s = it.skill; p = model.params[s]
                belief = model.belief_after(obs[s], foc[s], s) if obs[s] else p.p_L0
                yp.append(belief*(1.0-p.p_S) + (1.0-belief)*p.p_G); yt.append(it.correct)
            obs[it.skill].append(it.correct); foc[it.skill].append(it.focus)
    return roc_auc_score(yt, yp)

dkt_score, yt = dkt_auc(dkt, val_data)
bkt_score = bkt_auc(bkt, val_data)
base_rate = float(np.mean(yt))                       # majority/base-rate floor
print(f"{'Model':<28}{'held-out ROC-AUC'}")
print(f"{'-'*44}")
print(f"{'Base rate (always '+str(round(base_rate,2))+')':<28}0.500")
print(f"{'BKT (classic, interpretable)':<28}{bkt_score:.4f}")
print(f"{'DKT (deep LSTM)':<28}{dkt_score:.4f}")
```

Expect both models comfortably above 0.5, with DKT typically edging out BKT
because it exploits cross-topic transfer. (If they're close, that's a fine
finding too — on a small syllabus BKT is a strong baseline.)

---

## Cell 10 — Export everything, verify numpy parity, download

**What & why.** The EduFX server runs on CPU with **no torch**. BKT is already
pure numpy → save its params as `bkt.json`. For DKT we export the weights to
`dkt.npz` and prove a hand-written numpy LSTM forward pass reproduces PyTorch's
output (the `assert`) — this guards the gate-ordering when the server runs the
model without torch. Then download all four files.

```python
import json

# --- BKT -> bkt.json ---
bkt_payload = {str(s): {"p_L0": p.p_L0, "p_T": p.p_T, "p_S": p.p_S, "p_G": p.p_G}
               for s, p in bkt.params.items()}
json.dump(bkt_payload, open("bkt.json", "w"), indent=2)

# --- DKT -> dkt.npz (+ parity check) ---
def _np_forward(w, seq):
    H = w["W_hh"].shape[1]; h = np.zeros(H, np.float32); c = np.zeros(H, np.float32)
    for i in seq:
        x = encode_step(i.skill, i.correct, i.focus, i.tracked)
        g = w["W_ih"] @ x + w["b_ih"] + w["W_hh"] @ h + w["b_hh"]
        ii = _sigmoid(g[:H]); f = _sigmoid(g[H:2*H]); gg = np.tanh(g[2*H:3*H]); o = _sigmoid(g[3*H:4*H])
        c = f*c + ii*gg; h = o*np.tanh(c)
    return _sigmoid(w["W_out"] @ h + w["b_out"])

sd = dkt.state_dict()
weights = dict(
    W_ih=sd["lstm.weight_ih_l0"].cpu().numpy(), W_hh=sd["lstm.weight_hh_l0"].cpu().numpy(),
    b_ih=sd["lstm.bias_ih_l0"].cpu().numpy(),   b_hh=sd["lstm.bias_hh_l0"].cpu().numpy(),
    W_out=sd["head.weight"].cpu().numpy(),      b_out=sd["head.bias"].cpu().numpy())

sample = val_data[0]
with torch.no_grad():
    xs = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in sample])
    torch_last = torch.sigmoid(dkt(torch.from_numpy(xs).unsqueeze(0))[0, -1]).numpy()
assert np.allclose(torch_last, _np_forward(weights, sample), atol=1e-5), "numpy/torch mismatch"
print("DKT parity OK — max diff:", float(np.abs(torch_last - _np_forward(weights, sample)).max()))

np.savez("dkt.npz", **weights)
torch.save(sd, "dkt.pt")
json.dump({"num_skills": NUM_SKILLS, "input_dim": INPUT_DIM, "hidden_dim": HIDDEN_DIM,
           "encoding": "onehot(skill*correct) 2K + focus + tracked"},
          open("dkt_meta.json", "w"), indent=2)

from google.colab import files
for fn in ("bkt.json", "dkt.npz", "dkt.pt", "dkt_meta.json"):
    files.download(fn)
print("done — send these FOUR files back")
```

---

## Cell 11 — Re-download (if you closed the download prompt or lost the files)

**What & why.** Colab's runtime and its files stay alive as long as the tab/
session is connected, even if a browser download got missed or dismissed. Run
this on its own — no retraining — to re-trigger the download of files already
sitting in the Colab file system from Cell 10.

```python
from google.colab import files
import os

for fn in ("bkt.json", "dkt.npz", "dkt.pt", "dkt_meta.json"):
    if os.path.exists(fn):
        files.download(fn)
        print(f"downloaded: {fn}")
    else:
        print(f"missing: {fn} — the runtime was likely disconnected; re-run Cells 1-10")
```

If everything shows `missing`, the Colab runtime was recycled (common after long
idle periods) and the in-memory model is gone — re-run Cells 1–10 to retrain
(still under 2 minutes total) before downloading again.

---

## Hand-off

Send back the four files: **`bkt.json`, `dkt.npz`, `dkt.pt`, `dkt_meta.json`**.
They go into `server/app/ml/artifacts/`; the backend loads `bkt.json` and
`dkt.npz` (both numpy, CPU) — no torch, no GPU, no separate hosting.

---

## FAQ / viva talking points

**Do I need a GPU?** No. BKT is instant numpy; DKT is ~23,000 parameters and
trains on Colab CPU in ~1 minute. Contrast the fine-tuned Qwen quiz model
(7 *billion* params, needs a GPU host) — the recommender is ~300,000× smaller and
runs inside the normal FastAPI backend.

**BKT vs DKT — why both?** BKT is the interpretable baseline: one tiny HMM per
skill, four explainable parameters, fit with EM. DKT is the deep upgrade: one LSTM
across all skills, so it captures cross-topic transfer BKT can't. Training both
and measuring which wins (Cell 9) is a far stronger result than either alone.

**Why synthetic data?** Deep KT needs thousands of sequences; EduFX doesn't have
that many real students yet. The simulator is a standard bootstrap — and once real
logs accumulate, the same pipeline runs on them unchanged.

**What does the recommender do with the models?** They output `P(correct)` per
subtopic. A spaced-repetition policy then schedules *all* subtopics — weak ones
most often, new ones introduced then revisited, strong ones refreshed
occasionally — preferring subtopics whose predicted success sits in the
"Goldilocks zone" (challenging but not frustrating).

---

## Source: `docs\ml-recommender\recommender-learning-basics.md`

# EduFX Recommender Learning Guide - From Basics

This guide teaches the EduFX recommender training process from the beginning.
It is meant to be studied together with [recommender-colab-training.md](recommender-colab-training.md),
which contains the runnable Google Colab cells.

If the Colab notebook is the "how to run it" document, this file is the
"how to understand it" document.

---

## What We Are Building

EduFX needs a recommender that can answer:

- What does this student probably know?
- Which subtopic is weak?
- Which subtopic is ready to learn next?
- Which subtopic should be revised again later?

This is different from a text-generation model. We are not training an LLM to
write answers. We are training a **student modeling system**.

The training pipeline uses two models:

- `BKT` = Bayesian Knowledge Tracing
- `DKT` = Deep Knowledge Tracing

Both models look at a student's learning history and try to estimate how strong
the student is on each skill.

After that, another layer of logic can use those predictions to recommend the
next topic.

---

## The Big Picture

The full process is:

1. Build or collect student interaction data.
2. Represent each student's learning history as a sequence.
3. Train BKT as a classic, interpretable baseline.
4. Train DKT as a neural-network sequence model.
5. Compare how well both models predict future answers.
6. Export the trained artifacts so the backend can use them.

In EduFX right now, the notebook creates **synthetic student data** with a
simulator because there is not yet enough real student history for deep
training.

---

## Learning Order

Study the system in this order:

1. Simulator
2. BKT
3. DKT input encoding
4. DKT training loop
5. Evaluation
6. Export and backend integration

That same order is used below.

---

## Part 1 - Understand the Simulator First

### Why do we need a simulator?

Machine learning needs data.

For this recommender, the ideal data would be many real student sequences like:

- skill attempted
- correct or wrong
- focus level
- whether webcam tracking was enabled

But EduFX does not yet have enough real sequences to properly train a deep
model. So the notebook creates a **simulated dataset**.

This means we write rules for how a realistic student behaves, then generate
many fake students from those rules.

---

### What is one student history?

A student history is an ordered sequence of interactions such as:

1. Student attempts `G1 Reactions`, gets it right, focus `0.82`
2. Student attempts `G1 Thermal Stability`, gets it wrong, focus `0.41`
3. Student attempts `G2 Reactions`, gets it wrong, focus `0.33`

Order matters.

The same three answers in a different order can mean a different learning path.
That is why this is a **sequence learning** problem.

---

### What is hidden ability?

Inside the simulator, each student has a hidden ability value for each skill.
This is usually stored in a variable like `theta`.

You can think of `theta` as:

- a low number = weak understanding
- a high number = strong understanding

We do not directly show `theta` to the final model. It is only used inside the
simulator to create realistic correct/wrong answers.

So the simulator "knows" the truth, and the models later try to recover that
truth from visible behaviour.

---

### Why do we use a sigmoid?

A sigmoid function converts any real number into a value between `0` and `1`.

That is useful because probabilities must stay between `0` and `1`.

Basic intuition:

- very negative input -> close to `0`
- near zero -> around `0.5`
- very positive input -> close to `1`

In the simulator, sigmoid helps turn hidden ability into:

- probability of mastering a skill
- probability of answering correctly

---

### How does the simulator decide whether an answer is correct?

The simulator uses a function like `p_correct(...)`.

That function considers:

- the student's current ability on that skill
- any prerequisite boost from related skills
- the student's focus
- a "guess" chance
- a "slip" chance

This makes the synthetic data more realistic.

Example:

- A weak student may still get a question right by guessing.
- A strong student may still get a question wrong by slipping.
- A distracted student should usually do worse than a focused student.

---

### What are slip and guess?

These are classic educational modeling ideas.

`guess` means:

- the student did not really know it
- but still answered correctly by luck

`slip` means:

- the student actually knew it
- but still answered wrongly due to a mistake

These ideas are important because correct and wrong answers are not perfect
signals.

---

### How does learning happen in the simulator?

After a student attempts a skill, the simulator updates their hidden ability.

If focus is high:

- learning should increase more

If focus is low:

- learning should increase less

This is important because EduFX wants behaviour-aware recommendations. A correct
answer while distracted should not count the same as a correct answer while
fully focused.

---

### Why do prerequisites matter?

Some skills are related.

For example:

- doing well in one Group 1 concept can help with a similar Group 2 concept

The simulator includes this using a prerequisite map.

That means the model can later learn that success in one topic can improve the
chance of success in another topic.

This matters especially for DKT, because DKT is designed to learn
cross-topic transfer.

---

### What is `tracked`?

EduFX focus tracking is optional.

So each interaction includes:

- `focus`: a number between `0` and `1`
- `tracked`: `1` if focus was measured, `0` if it was skipped

If tracking is skipped, the current design uses:

- `focus = 1.0`
- `tracked = 0`

This means:

- students are not punished for skipping tracking
- the model can still tell the difference between "fully focused" and "not measured"

---

### What does the simulator finally produce?

It produces many student histories.

For example:

- 3,000 students
- around 150,000 total interactions

Then the notebook splits that into:

- training data
- validation data

Training data teaches the model. Validation data checks whether the model
actually learned something useful.

---

## Part 2 - Understand BKT

### What is BKT?

`BKT` stands for **Bayesian Knowledge Tracing**.

It is a classic educational model. For each skill, it assumes the student is in
one of two hidden states:

- not learned
- learned

We never observe that state directly. We only observe:

- correct answers
- wrong answers

So BKT tries to estimate the probability that the student has learned the skill.

---

### Why is BKT useful?

BKT is useful because it is small, fast, and interpretable.

You can explain each parameter in plain words.

That makes it:

- a good baseline
- easy to defend in a viva
- easy to debug
- a safe fallback if the deep model is missing or worse

---

### What are the 4 BKT parameters?

For each skill, BKT learns four values:

`L0`
: probability the student already knew the skill before practice

`T`
: probability the student learns the skill after an attempt

`S`
: slip probability, meaning they knew it but still answered wrong

`G`
: guess probability, meaning they did not know it but still answered right

These are powerful because every one of them has a meaning you can explain.

---

### What does "hidden state" mean?

The model assumes the student has a real internal state:

- knows the skill
- does not know the skill

But we cannot directly see that.

We only see answers, which are noisy.

So BKT uses probability to reason about the hidden state.

---

### Why is BKT trained per skill?

BKT usually builds one small model per skill.

That means:

- one model for Group 1 Reactions
- one model for Group 1 Thermal Stability
- one model for Group 2 Reactions
- and so on

This is both a strength and a weakness.

Strength:

- simple and interpretable

Weakness:

- it does not naturally learn relationships across skills

That weakness is one reason we also train DKT.

---

### How does BKT train?

BKT does not train with backpropagation like a neural network.

It uses a statistical process called **Expectation-Maximization (EM)**.

Simple intuition:

1. Start with guessed parameter values.
2. Estimate the hidden learned/not-learned states using those values.
3. Update the parameters based on those estimates.
4. Repeat many times.

This cycle gradually improves the parameters.

---

### What is forward-backward in BKT?

The forward-backward algorithm is a probability procedure used inside Hidden
Markov Models.

Its job is to estimate:

- how likely the student was in each hidden state at each time step

It uses:

- past observations
- future observations

That gives a better estimate than looking only one step at a time.

---

### How does BKT use focus?

In EduFX, BKT is behaviour-aware.

Low focus should make an answer less trustworthy.

So instead of treating a distracted correct answer as strong evidence, BKT
adjusts slip and guess toward `0.5`.

That means:

- a distracted answer changes mastery less
- a focused answer changes mastery more

This is a smart way to use behaviour without redesigning the whole BKT model.

---

### What does BKT output?

BKT can output:

- probability the student has mastered a skill
- probability the student would answer correctly on a skill

That output can then be used later by the recommendation policy.

---

## Part 3 - Understand DKT Input Encoding

### What is DKT?

`DKT` stands for **Deep Knowledge Tracing**.

Instead of building one small model per skill, it builds one neural network that
reads the entire student sequence.

That allows it to learn patterns like:

- mastering one topic helps with another topic
- students with certain learning paths behave similarly
- focus and skill history together affect future success

---

### Why do we need input encoding?

A neural network cannot directly understand:

- "skill 3, correct, focus 0.81"

It needs numbers arranged in vectors.

So we encode each interaction into a numeric format.

This conversion step is called **input encoding**.

---

### What is one-hot encoding?

If there are 10 skills, one-hot encoding represents a skill using a vector of
length 10 where:

- one position is `1`
- all other positions are `0`

Example:

- skill `2` becomes `[0, 0, 1, 0, 0, 0, 0, 0, 0, 0]`

That tells the network exactly which skill happened.

---

### Why do we use `2K + 2` dimensions?

If there are `K = 10` skills, the notebook uses:

- first 10 positions for "correct on skill"
- next 10 positions for "wrong on skill"
- 1 position for `focus`
- 1 position for `tracked`

So total size is:

- `2 * 10 + 2 = 22`

This is written as `2K + 2`.

---

### Why split correct and wrong into separate halves?

Because the model should know both:

- which skill was attempted
- whether the result was correct or wrong

If skill `4` is answered correctly, that should be different from skill `4`
answered wrongly.

So the encoding uses:

- one half for correct events
- one half for wrong events

This is a common DKT encoding idea.

---

### Why are `focus` and `tracked` appended?

These two values add behavioural context.

`focus` tells the model:

- how attentive the student was during that interaction

`tracked` tells the model:

- whether focus was actually measured

This helps the model interpret answers more fairly.

A correct answer with low focus might be weaker evidence than a correct answer
with high focus.

---

### What does one encoded step mean?

One encoded vector means:

- which skill happened
- whether it was correct or wrong
- how focused the student was
- whether tracking was on

That one vector is one time step in the student's sequence.

Then the full student history becomes a sequence of those vectors.

---

## Part 4 - Understand the DKT Training Loop

### Why use an LSTM?

An `LSTM` is a type of recurrent neural network designed for sequences.

It is useful here because learning history matters over time.

The model should remember:

- what the student did earlier
- which topics improved
- which mistakes repeated
- how focus changed over time

LSTMs are built to keep and update a memory state while reading a sequence.

---

### What does the DKT model predict?

At each step, the DKT model predicts:

- probability of answering correctly for each skill

During training, we mainly score it on the skill the student actually attempts
next.

So the model learns to answer:

"Given everything so far, how likely is the next answer on this skill to be correct?"

---

### What is a batch?

Instead of training on one student at a time, we usually train on a small group
of students together.

That group is called a **batch**.

Batching is useful because:

- it is faster
- it uses matrix operations efficiently
- it makes training more stable

---

### Why do we pad sequences?

Not all students have histories of the same length.

Examples:

- one student may have 31 interactions
- another may have 67 interactions

But neural networks in batches usually need rectangular arrays.

So we pad shorter sequences with zeros.

Then we use a **mask** so the model does not treat padding as real data.

---

### What is the training target?

The training task is **next-step prediction**.

At time step `t`, the model uses the history up to that point to predict the
outcome at time step `t + 1`.

That teaches the model how learning evolves.

This is better than just fitting current labels, because recommendation is
really about predicting future success.

---

### What is loss?

Loss is a number that measures how wrong the model is.

In this notebook, the training loop uses binary cross-entropy loss for
correct/wrong prediction.

Basic intuition:

- lower loss = model predictions are better
- higher loss = model predictions are worse

During training, you want loss to decrease across epochs.

---

### What is an epoch?

One epoch means:

- the model has seen the whole training dataset once

If you train for 20 epochs, the model goes through the dataset 20 times.

Each epoch should usually improve the weights a bit more.

---

### What is backpropagation?

Backpropagation is how the neural network learns from mistakes.

Simple idea:

1. The model makes predictions.
2. Loss measures the error.
3. Backpropagation calculates how each weight contributed to that error.
4. The optimizer updates the weights to reduce future error.

This is the core learning mechanism in deep learning.

---

### What is the optimizer?

The optimizer decides how to change the model weights.

In this notebook, the optimizer is `Adam`.

You can think of Adam as a smart rule for:

- how big each update should be
- how fast learning should happen

It is one of the most common choices in modern deep learning.

---

### What is `gather(...)` doing?

The model outputs predictions for **all skills** at each time step.

But the next real interaction only belongs to one actual skill.

So `gather(...)` selects the prediction for the skill that was really attempted.

That is the one we compare against the real answer.

---

### What does a good training run look like?

A healthy training run usually shows:

- loss gradually going down
- no crashes or shape mismatches
- evaluation score above the baseline

That tells you the model learned useful sequence patterns.

---

## Part 5 - Understand Evaluation

### Why do we need evaluation?

Training performance alone is not enough.

A model can memorize training data and still fail on new students.

So we keep separate validation data that the model never trained on.

Then we test whether the model still predicts well there.

That is the real check of generalization.

---

### What is the baseline?

A baseline is a simple reference point.

Examples:

- always predict the average correctness rate
- use BKT as the classic baseline

This helps answer:

"Is the deep model actually better, or just more complicated?"

---

### What is ROC-AUC?

`ROC-AUC` is a common evaluation metric for binary classification.

Here, the binary classes are:

- correct
- wrong

Very simple interpretation:

- `0.5` = random guessing
- above `0.5` = the model learned useful ranking
- closer to `1.0` = much better ranking

ROC-AUC does not ask for one hard yes/no prediction. It asks whether the model
gives higher confidence to truly correct cases than to wrong ones.

---

### Why compare BKT and DKT?

Because model choice should be evidence-based.

If DKT performs better:

- use it as the main model

If BKT is similar or better:

- keep BKT or use it as fallback

This comparison is important academically too, because it shows you did not
blindly choose the deep model.

---

### What is a good outcome?

A good outcome is usually:

- both models beat the trivial baseline
- DKT slightly or clearly beats BKT

If BKT stays close to DKT, that is still a valid finding. On a small skill set,
simple models can stay strong.

---

## Part 6 - Understand Export and Backend Integration

### Why export model files?

After training, the models exist only in memory inside Colab.

To use them in the real EduFX backend, we must save them to files.

That saved form is called an **artifact**.

---

### What files are exported?

The notebook exports:

- `bkt.json`
- `dkt.npz`
- `dkt.pt`
- `dkt_meta.json`

Each file has a different role.

---

### What is `bkt.json`?

`bkt.json` stores the trained BKT parameters for each skill:

- `L0`
- `T`
- `S`
- `G`

It is human-readable and easy for the backend to load.

---

### What is `dkt.pt`?

`dkt.pt` is the native PyTorch checkpoint.

It is useful for:

- resuming training
- inspecting the original torch model
- debugging inside a PyTorch environment

It is not the main serving format for the EduFX backend.

---

### What is `dkt.npz`?

`dkt.npz` stores the DKT weights in NumPy format.

This is important because the EduFX backend is designed to run inference
without depending on PyTorch at serving time.

That gives a lighter production setup.

So:

- `dkt.pt` is training-friendly
- `dkt.npz` is serving-friendly

---

### What is `dkt_meta.json`?

This file stores metadata such as:

- number of skills
- input dimension
- hidden dimension
- encoding format

It is useful for documentation and for checking that the saved weights match the
expected architecture.

---

### Why do we check NumPy parity?

The DKT model is trained in PyTorch, but served in NumPy.

That creates a risk:

- what if the NumPy implementation behaves differently from the PyTorch one?

So the notebook performs a parity check.

It runs the same sample through:

- PyTorch model
- NumPy forward pass

Then it confirms the outputs are almost identical.

If they match, we can trust the backend inference path.

---

### How does this connect to the backend?

After training, the downloaded files go into:

`server/app/ml/artifacts/`

Then the backend can:

- load `bkt.json`
- load `dkt.npz`
- compute predicted correctness or mastery
- pass those predictions into the recommendation logic

The recommendation logic then decides:

- what to introduce next
- what to revise
- what is overdue

So the model is the prediction engine, and the policy is the decision engine.

---

## Final Mental Model

If you remember only one summary, remember this:

### Simulator

Creates many realistic student histories.

### BKT

A simple probabilistic model that estimates whether each skill is learned.

### DKT input encoding

Turns each interaction into numbers the neural network can read.

### DKT training loop

Shows sequences to the LSTM, measures mistakes, and updates weights.

### Evaluation

Checks whether the trained models predict future answers better than a baseline.

### Export and integration

Saves the trained models into files the EduFX backend can load and use.

---

## Recommended Study Routine

Use this routine if you want to really learn the notebook:

1. Read the simulator section in this file.
2. Open [recommender-colab-training.md](recommender-colab-training.md).
3. Study Cell 3 and match each block to the simulator explanation here.
4. Then study the BKT section here and compare it with the BKT cells.
5. Then move to DKT encoding and training loop.
6. Finally study evaluation and export.

Do not rush to run all cells before understanding what each part is doing.
Understanding the data flow is much more important than memorizing syntax.

---

## Next Best Step

After reading this guide, the best next step is:

1. open the Colab notebook guide
2. focus only on the simulator cell first
3. trace each variable slowly
4. then move to BKT

If you want an even deeper walkthrough, the next teaching document can be:

- "Simulator line-by-line"
- "BKT line-by-line"
- "DKT line-by-line"

That would be the best follow-up for true beginner learning.

---

## Source: `docs\plans\recommender-implementation-plan.md`

# EduFX ML Recommender — Knowledge Tracing (BKT + DKT)

## Context — why this plan exists

EduFX currently recommends subtopics with a hand-tuned heuristic in
`server/app/services/scheduler_service.py` + `compute_priority()` in
`server/app/core/rules.py`:

```
priority = days_since_last_studied × level_multiplier   (beginner 3.0, inter 2.0, adv 0.5)
```

It picks 2 "weak" + 1 "strong" subtopic per day, with an overdue override and a
1-day cooldown. This is a real, working rule — but it is not *learned* from
data, and it has three concrete blind spots:

1. **No cross-topic transfer.** It can't know that mastering "G1 thermal
   stability" (concept: polarizing power) makes "G2 thermal stability" easier —
   every subtopic is scored in isolation.
2. **No uncertainty.** A student who has answered 1 question on a subtopic and
   a student who has answered 20 get treated identically if their last score is
   the same.
3. **No behaviour signal.** A quiz passed while phone-distracted counts exactly
   the same as one passed while fully focused, even though EduFX already
   collects `focus_score` per session via the webcam tracker.

The user wants to replace/augment this with a **real machine-learning
recommender**, explicitly as a learning exercise — building understanding of
both classic ML and deep learning for adaptive education, the same way the
Qwen fine-tune was a hands-on deep-learning exercise. Two models were agreed:

- **BKT** (Bayesian Knowledge Tracing) — classic, fully interpretable.
- **DKT** (Deep Knowledge Tracing) — an LSTM, captures cross-topic transfer.
- Both **behaviour-aware**: `focus_score` feeds the model so a distracted
  correct answer counts as weaker evidence of mastery.
- **DKT training happens in Google Colab**, by the user, so they build it
  hands-on (same workflow as the earlier Qwen fine-tune) — I hand back code +
  a guide, they run it and hand back the trained weights.

This is a small **self-trained statistical/deep model**, not an LLM call — it
does not touch the "Vertex-AI-only for generation" project rule, and (explained
below) needs no GPU to serve.

---

## The concept: Knowledge Tracing, explained

**Knowledge Tracing (KT)** is the standard formulation of "recommend the right
next thing to study" in adaptive learning research. The question it answers:

> Given everything a student has done so far, what is the probability they have
> mastered each skill — and therefore, what should they attempt next?

A "skill" here = one of EduFX's 10 S-block subtopics. The input is the
student's ordered history of interactions: `(subtopic, correct/incorrect,
focus_level)` triples. The output is `P(mastered)` per subtopic, which then
feeds a **recommendation policy** (below) that turns probabilities into an
actual "study this next" decision.

### Model 1 — BKT (Bayesian Knowledge Tracing)

**What it is.** For *each skill independently*, BKT is a 2-state Hidden Markov
Model. The hidden state is binary: has the student learned this skill or not?
You never observe that directly, only whether they answered correctly. Four
parameters per skill describe the whole process:

| Param | Meaning |
|---|---|
| `L0` | P(already knew it before any practice) — the prior |
| `T`  | P(transitions from unknown → known on one attempt) — the learn rate |
| `S`  | P(answers wrong even though they know it) — "slip" |
| `G`  | P(answers right by luck even though they don't know it) — "guess" (~0.25 for 4-option MCQ) |

Two structural assumptions make it a *learning* model, not a generic HMM: state
is **absorbing** (once learned, BKT assumes no forgetting) and learning only
happens *between* attempts, at rate `T`.

**How it's fit.** Standard **Expectation-Maximization (EM)** — the Baum-Welch
algorithm: repeatedly (a) run forward-backward to get the posterior probability
of "known" at every timestep given the current parameters, then (b)
re-estimate `L0, T, S, G` from those posteriors. Repeat until the likelihood
stops improving. Pure numpy, trains on ~800 synthetic students in well under a
second.

**Why it's a great baseline.** Every number is defensible in a viva — "this
skill's slip is 0.08, so a wrong answer here is probably a slip, not ignorance."
Its structural weakness (which motivates DKT) is that each skill's HMM is
blind to every other skill.

**Behaviour-aware twist (already implemented in `bkt.py`).** Rather than
retraining EM per focus level, focus is folded in at *inference* time: when
updating the mastery belief after an answer, low focus inflates the effective
slip/guess toward 0.5 — i.e. a distracted answer carries almost no information,
so it barely moves the belief. Verified: a student who drills a skill fully
focused reaches mastery 0.999; the identical drill while distracted only
reaches 0.959; never-touching a skill stays near the 0.01–0.09 prior.

### Model 2 — DKT (Deep Knowledge Tracing)

**What it is** (Piech et al., NeurIPS 2015 — the paper that started this whole
subfield). Instead of one HMM per skill, DKT uses **one shared LSTM** that
reads the student's *entire* interaction sequence and, at every timestep,
outputs `P(correct)` for **all 10 skills simultaneously** — not just the one
just attempted.

Because the network is shared across skills, it can learn things BKT
structurally cannot: e.g. that succeeding on "G1 thermal stability" (which
teaches the "polarizing power" concept) should raise the predicted `P(correct)`
on "G2 thermal stability" too, even though the student hasn't touched G2 yet.
This cross-topic transfer is the entire reason to reach for a deep model here —
your 10 subtopics are explicitly designed with this kind of shared-concept
structure (see `PREREQUISITES` in `app/ml/__init__.py`).

**Input encoding.** At step *t*, the network reads a vector:

```
[ one-hot(skill) if correct | one-hot(skill) if wrong | focus ]
    \_______ 10 dims _______/   \_______ 10 dims _______/   1 dim
```

21 dimensions total (`2 × NUM_SKILLS + 1`). The trailing `focus` value is the
**behaviour-aware** part — instead of hand-crafting how focus should discount
evidence (as BKT does), the LSTM learns it directly from the training data,
because the simulator already couples low focus with lower correctness and
smaller ability gains.

**Output & training.** The LSTM's hidden state at step *t* feeds a linear head
producing 10 logits → sigmoid → `P(correct)` per skill. The training target at
step *t* is whether the student got the skill they attempted at step *t+1*
right — a standard **next-step prediction** objective, masked binary
cross-entropy so padding doesn't pollute the loss.

**Where the code lives:** `server/app/ml/dkt.py` is deliberately split in two:

- **Numpy half (`DKTInference`)** — hand-rolls the LSTM forward pass
  (input/forget/cell/output gates) from exported weights. **This is what the
  server runs.** No torch import needed to serve it.
- **Torch half (`build_model`, `train_dkt`, `export_numpy`)** — import-guarded
  behind a `_require_torch()` check, so importing `dkt.py` on a torch-free
  server is safe; the torch code path is simply never reached. This is what
  Colab runs.

### Why no GPU / hosting problem (unlike the Qwen fine-tune)

This is the standout practical difference from the earlier LLM fine-tune, and
worth being very explicit about since that earlier work needed a whole hosting
investigation (Azure VM, vLLM, etc.):

| | Fine-tuned Qwen (Task A quiz gen) | DKT recommender |
|---|---|---|
| Parameters | 7,000,000,000 | **~23,000** |
| Size on disk | ~4 GB (4-bit) | **~90 KB** |
| Needs GPU to serve? | Yes | **No** |
| Where it runs | Separate GPU host (Azure/vLLM) | **Inside the existing FastAPI backend, CPU** |
| Inference cost | Seconds, needs a live model server | **Microseconds, in-process** |

The DKT is one small LSTM (hidden size 64). Scoring all 10 subtopics for a
student with a ~50-step history is a handful of matrix multiplies — no
separate deployment, no on/off VM toggling, nothing beyond the numpy file
already in your `requirements.txt`.

### The recommendation policy — coverage-aware spaced repetition (+ ZPD)

Neither model *is* a recommender by itself — they output a mastery / `P(correct)`
per subtopic. The policy that turns those numbers into a study plan must satisfy
an explicit requirement from the user:

> **Teach ALL subtopics, not only the weak ones — but give weak ones more
> focus.** New subtopics get introduced and then revisited (e.g. a day later);
> weak subtopics come back often (e.g. twice as frequently); average subtopics
> at a medium cadence; strong subtopics still resurface occasionally so they
> aren't forgotten.

That is textbook **spaced repetition** with **mastery-adaptive intervals** — the
same idea as Anki/Leitner, but the interval is driven by the ML mastery estimate
instead of a self-report. It also *extends what EduFX already has*:
`LEVEL_DEADLINES` in `rules.py` (beginner 3 / intermediate 7 / advanced 14 days)
is already a per-level review interval — we generalize it so the interval keys
off model mastery, and so **every** subtopic is on a schedule.

**How the pieces combine.** For each of the 10 subtopics we compute a priority
from three factors, then build a *mixed* daily plan rather than an all-weak one:

1. **Mastery tier → base review interval** (how often it should come back):

   | Tier (from model mastery) | Interval | Role in the plan |
   |---|---|---|
   | New (never studied) | introduce now, review +1 day | onboarding — always surfaced early |
   | Weak (mastery ≤ ~0.4) | ~1 day | **most** daily slots — the focus |
   | Average (~0.4–0.7) | ~3 days | medium cadence |
   | Strong (> ~0.7) | ~7–14 days | light maintenance so it isn't forgotten |

2. **Spacing / due-ness**: a subtopic becomes *due* when
   `days_since_studied ≥ its interval`. Overdue items rise in priority (reusing
   the existing overdue logic in `compute_priority`). This is what makes old
   weak subtopics come back "twice" while strong ones wait.

3. **ZPD readiness** (`ZPD_TARGET = 0.65`, band `0.45–0.85` in
   `app/ml/__init__.py`): among *due* subtopics whose hard prerequisites are met
   (`prerequisites_met()`), prefer the one whose predicted `P(correct)` is in the
   "Goldilocks zone" — challenging but not frustrating. This stops the plan from
   throwing a subtopic at a student before they're ready for it, and breaks ties
   sensibly.

**The daily plan is therefore a coverage mix**, e.g. weighted toward weak/due
subtopics but always including any *new* subtopic that needs introducing and any
*strong* subtopic that has gone long enough to need a refresh — so over a week
all 10 subtopics get touched, with weak ones touched the most. This replaces the
current fixed "2 weak + 1 strong" split with a mastery- and spacing-driven mix,
while keeping the same idea of a small, focused daily set.

### Why simulate students instead of training on real EduFX data

Deep KT models in the literature are trained on **thousands** of real student
sequences (e.g. the ASSISTments dataset has ~15,000 students). EduFX currently
has a handful of demo/test students — nowhere near enough to fit an LSTM
without severe overfitting. The standard, legitimate fix (and a good exercise
in itself) is a **synthetic student simulator**
(`server/app/ml/simulator.py`, already built and validated):

- Each virtual student has a hidden per-skill ability (`theta`), starting low.
- Answering follows an **item-response** logistic curve with slip/guess, so
  it behaves like a real 4-option MCQ.
- Practising a skill raises ability with diminishing returns, **scaled by
  focus** — distracted practice barely helps, matching the behaviour-aware
  premise everywhere else in this design.
- Ability on a skill is boosted by mastered prerequisites (`PREREQUISITES`),
  which is exactly the cross-topic transfer structure DKT is meant to
  discover.

Validated output: within-session accuracy rises 0.38 → 0.62 as students
practice, and focused vs distracted accuracy is 0.58 vs 0.42 — both signals
are cleanly present, so a model that successfully learns from this corpus is
demonstrably learning the right things. Real EduFX interaction logs can be fed
into the same pipeline later, once enough accumulate; nothing about the model
code is simulator-specific.

### Handling students who skip behaviour tracking

The webcam check screen already lets a student **skip tracking**
(`webcam-check-screen.tsx` — "Skip tracking" button; `SessionSummary.focus_score`
and `BehaviourSummaryRequest.focus_score` are both `int | None` in the domain
model precisely because tracking is optional per session). The recommender
must not break, and must not unfairly penalize, a student who opts out.

**Design decision:** add an explicit **`tracked` flag** alongside the
continuous `focus` value, rather than silently defaulting untracked sessions to
some guessed focus number:

- When tracking is **on**: `tracked = 1`, `focus = focus_score / 100`.
- When tracking is **off**: `tracked = 0`, `focus = 1.0` (neutral/full credit —
  an opted-out student is never treated as if they were distracted).

This changes the DKT input from `2K + 1` to **`2K + 2`** dimensions
(`server/app/ml/dkt.py`'s `encode_step`), and BKT's focus-adjustment
(`BKTModel._focus_adjust`) treats `tracked=0` as "no discount" — identical to
`focus=1.0`. The simulator (`server/app/ml/simulator.py`) is updated to make
some sessions untracked (a per-student toggle, since in practice a student
tends to consistently enable or disable it) so both models see and learn to
handle the untracked case, not just infer it from an unseen corner of the
input space.

**Why the explicit flag instead of just defaulting focus to 1.0 alone:** it
keeps "fully focused" and "we don't know" statistically distinguishable to the
model even though they get the same *charitable* treatment today — leaving
room for the model to learn a difference later if real data ever shows tracked
and untracked students behave differently, without re-deriving the encoding.

**Product framing (for docs/UI copy, not a behaviour change):** behaviour
tracking is and stays fully optional — the recommender works correctly without
it. The value proposition to surface to the user is "recommendations get more
precise when focus tracking is on, because we can tell a lucky guess made
while distracted apart from a confident, focused answer" — an incentive to
enable it, not a requirement to use the platform.

This must land in `simulator.py` / `bkt.py` / `dkt.py` **before** Colab
training (an encoding change after training invalidates the weights).

---

## What's already built this session (local, uncommitted)

- `server/app/ml/__init__.py` — skill map (10 subtopics ↔ 0-based skill index),
  `mastery_to_level`, prerequisite graph, ZPD constants.
- `server/app/ml/simulator.py` — synthetic student generator, validated (see
  numbers above).
- `server/app/ml/bkt.py` — BKT via EM, pure numpy. **Trained + validated**
  (`artifacts/bkt.json` saved; behaviour-aware inference confirmed).
- `server/app/ml/dkt.py` — DKT torch model + numpy inference, **written, not
  yet trained**.
- `server/requirements.txt` (+numpy), `server/requirements-ml.txt` (torch,
  training-only, not part of the deployed image).

## Immediate deliverable — a self-contained Colab TRAINING guide (the .md)

**Clarified with the user:** the `.md` must contain the actual **Google Colab
training code** — the runnable notebook cells you paste into Colab to train the
model — each with an **explanation and the reasoning behind it**. It is NOT a
description of the backend project files and does NOT reference/upload
`app/ml/*.py`. It is a standalone teaching-and-training document: read the why,
copy the cell, run it, watch it train, download the weights. Same spirit as the
existing `docs/finetune-colab-guide.md`, which has real runnable cells.

**File:** `docs/ml-recommender/recommender-colab-training.md`

**Structure (every code section is a full, self-contained, copy-paste Colab
cell, preceded by a plain-English "what this does and why"):**

- **Intro** — what we're training (a DKT knowledge-tracing model that recommends
  the next subtopic by predicting mastery), why it matters (replaces the flat
  rule-based scheduler), and why Colab (hands-on learning; GPU optional because
  the model is tiny).
- **Cell 1 — Install** `torch numpy scikit-learn`, with a note on why torch is
  only needed for *training*, not serving.
- **Cell 2 — Config / skill map**: the 10 S-block subtopics, the prerequisite
  graph, and *why* prerequisites encode the cross-topic transfer DKT will learn.
- **Cell 3 — The student simulator** (full inline code): the generative model of
  learning — latent ability, the item-response (logistic) correctness curve with
  slip/guess, focus-scaled learning, prerequisite boosts. Explanation of *why we
  simulate* (deep KT needs thousands of sequences; EduFX has few real students
  yet) and the validated signals it produces.
- **Cell 4 — Behaviour tracking is optional** (the `tracked` flag): how a
  skipped-webcam session is encoded (`tracked = 0`, `focus = 1.0` — full credit,
  never penalized) vs a tracked one, and *why* an explicit flag beats silently
  guessing a focus number. Also the product framing: tracking stays optional;
  it just makes recommendations sharper when on.
- **Cell 5 — The DKT model** (full inline PyTorch code): the input encoding
  (`2K + 2` = one-hot(skill×correct) + focus + tracked), the LSTM, the
  per-skill sigmoid output head. Explanation of each piece.
- **Cell 6 — Training loop**: masked binary-cross-entropy next-step prediction,
  Adam, per-epoch loss. Explanation of the objective (predict the *next*
  answer) and the masking (ignore padding).
- **Cell 7 — Evaluation**: held-out **ROC-AUC** so you can see it working, and a
  short read on what a good number looks like and how it beats a coin-flip / the
  heuristic.
- **Cell 8 — Export & download**: save the trained weights as `dkt.npz`
  (numpy — for torch-free serving), `dkt.pt` (torch checkpoint), and
  `dkt_meta.json` (architecture record), then `files.download(...)` each.
  Explanation of *why numpy export* = the server runs the model on CPU with no
  torch and no GPU.
- **Hand-off** — send the three downloaded files back; they get placed in
  `server/app/ml/artifacts/`.
- **Why DKT / FAQ / viva talking points** — DKT vs BKT, why no GPU is needed
  (the size/latency table vs the fine-tuned Qwen), and what to say in the viva.

**Consistency requirement:** the model architecture in Cell 5 (LSTM hidden=64,
`2K+2` encoding, gate order) and the export format in Cell 8 (npz key names)
must match `server/app/ml/dkt.py`'s `DKTInference` exactly, so the weights the
guide produces load and run correctly in the backend. The backend `dkt.py`
/`simulator.py`/`bkt.py` get the same `tracked`-flag update (see Files) so the
two stay in lockstep; the guide is the standalone learning+training copy.

BKT needs no Colab (pure numpy, trains instantly) — the guide ends with a one
-liner noting BKT is fit locally and doesn't require this notebook.

## Downstream phases (after artifacts return)

- **Phase 4 — `server/app/ml/evaluate.py`**: held-out simulated students,
  next-answer AUC/accuracy for BKT vs DKT vs a rule-based proxy — the viva
  comparison table ("my ML model beats the heuristic by X%").
- **Phase 5 — recommender wiring**: `server/app/ml/recommender.py` implements the
  **coverage-aware spaced-repetition policy above** — mastery-tier review
  intervals, due-ness/overdue, ZPD tie-break, prerequisite-gating, behaviour
  down-weighting — so it produces a *mixed* daily plan covering all subtopics
  with weak ones weighted highest, not an all-weak list.
  `server/app/services/recommender_service.py` loads DKT if present, else BKT,
  else nothing — graceful degrade. Blended into
  `SchedulerService.get_todays_plan`; the existing `compute_priority` rule stays
  as the fallback when no model is trained, so the app never breaks. The plan
  still returns a small daily set but selects it by mastery + spacing instead of
  the fixed "2 weak + 1 strong" split.
- **Phase 6**: expose via the plan endpoint (or a new `/recommendations`
  route), unit tests under `server/tests/unit/`, and
  `docs/recommender-guide.md` — the full math + behaviour-aware rationale +
  eval numbers + viva talking points, mirroring `docs/finetune-method.md`.

## Files

- **New now (the immediate ask):** `docs/ml-recommender/recommender-colab-training.md` — the
  self-contained Colab training guide with full inline code + explanations.
- Edited (behaviour-tracking-optional `tracked` flag; keeps the backend copies
  in sync with the guide's encoding, before Colab training):
  `server/app/ml/simulator.py`, `server/app/ml/bkt.py`, `server/app/ml/dkt.py`.
- After hand-off: `server/app/ml/artifacts/{dkt.npz,dkt.pt,dkt_meta.json}`.
- Later phases: `server/app/ml/evaluate.py`, `server/app/ml/recommender.py`,
  `server/app/services/recommender_service.py`, edits to
  `server/app/services/scheduler_service.py`, tests, `docs/recommender-guide.md`.
- Already created: `server/app/ml/{__init__,simulator,bkt,dkt}.py`,
  requirements files, `artifacts/bkt.json` (the last two regenerated after the
  `tracked`-flag edit, which changes BKT's inference signature too).

## Verification

- **In Colab (user):** `train.py` prints decreasing loss + held-out AUC
  (expect comfortably above 0.5, competitive with/above BKT), and the
  torch-vs-numpy parity assert must pass before export.
- **Locally (after hand-off, no torch needed):** load `DKTInference` from
  `dkt.npz`, run `predict_p_correct` on a hand-built history — drilled skill
  should score high, an untouched skill near base rate, a distracted-drill
  history lower than a focused one.
- **Phase 4:** `python -m app.ml.evaluate` prints the BKT/DKT/rule-based table.
- **Phase 6:** `pytest server/tests/unit` green; hit the plan endpoint and
  confirm recommendations shift with a student's history and focus level.

---

# Appendix A — Full Colab training code (copy-paste cells)

This is the exact content that will become `docs/ml-recommender/recommender-colab-training.md`.
Every cell is self-contained: paste into a Colab notebook top-to-bottom and run.
The model architecture (LSTM hidden=64, `2K+2` input encoding, PyTorch gate
order) matches the backend `server/app/ml/dkt.py` `DKTInference`, so the weights
you download load and run in the server with no changes.

---

### Cell 1 — Install

**What & why.** We only need three libraries. `torch` builds and trains the
LSTM. `numpy` handles arrays and, later, the tiny CPU inference the *server*
uses. `scikit-learn` gives us `roc_auc_score` for evaluation. Note: torch is a
*training-only* dependency — the EduFX backend never imports it, because we
export plain numpy weights at the end (Cell 8).

```python
!pip -q install torch numpy scikit-learn
print("installed")
```

---

### Cell 2 — Config & the skill map

**What & why.** Our "skills" are the 10 S-block subtopics. The **prerequisite
graph** encodes which subtopics build on which — e.g. skill 7 (G2 thermal
stability) depends on skill 6 (G2 reactions) and is *primed* by skill 2 (G1
thermal stability, which teaches the same "polarizing power" idea). This
cross-topic structure is exactly what the deep model will learn to exploit and
what the old flat heuristic is blind to.

```python
import numpy as np

NUM_SKILLS = 10
SKILL_LABELS = {
    0: "G1 · Group trends", 1: "G1 · Reactions",     2: "G1 · Thermal stability",
    3: "G1 · Solubility",   4: "G1 · Flame tests",
    5: "G2 · Group trends", 6: "G2 · Reactions",     7: "G2 · Thermal stability",
    8: "G2 · Solubility",   9: "G2 · Flame tests",
}

# skill -> list of (prerequisite_skill, strength 0..1)
# strength >= 0.6 = hard prerequisite (gates recommendation);
# weaker links = cross-group "priming" (a learning boost, not a blocker).
PREREQUISITES = {
    0: [],                    1: [(0, 1.0)],           2: [(1, 1.0)],
    3: [(1, 1.0)],            4: [(1, 1.0)],
    5: [(0, 0.4)],            6: [(5, 1.0), (1, 0.4)], 7: [(6, 1.0), (2, 0.4)],
    8: [(6, 1.0), (3, 0.4)],  9: [(6, 1.0), (4, 0.4)],
}
print("skills:", NUM_SKILLS)
```

---

### Cell 3 — The student simulator (synthetic training data)

**What & why.** Deep knowledge-tracing models need *thousands* of student
histories; EduFX doesn't have that many real students yet. So we hand-write a
small **generative model of learning** and sample virtual students from it —
a standard, legitimate way to prototype (and a great way to understand what the
model must recover).

The three ingredients: (1) each student has a hidden per-skill **ability**
(`theta`) that starts low and grows with practice; (2) **answering** follows a
logistic item-response curve with slip/guess so it behaves like a real 4-option
MCQ; (3) **focus** varies per attempt — low focus both hurts the answer and
slows learning. Mastered prerequisites boost effective ability, creating the
cross-topic transfer DKT should discover.

```python
from dataclasses import dataclass

_DISCRIMINATION = 1.7    # steepness of the correctness curve
_SLIP  = 0.10            # P(wrong | fully mastered)
_GUESS = 0.25            # P(right | no idea) — 4-option MCQ
_LEARN_RATE   = 0.85     # ability gained per focused practice
_PREREQ_BOOST = 0.9      # lift from mastered prerequisites
_START_THETA  = -1.8     # ability floor before practice
_THETA_CEILING = 3.5     # mastery asymptote

def _sigmoid(x): return 1.0 / (1.0 + np.exp(-x))

@dataclass(frozen=True)
class Interaction:
    skill: int
    correct: int
    focus: float     # recorded focus (1.0 if not tracked — see Cell 4)
    tracked: int     # 1 = webcam focus measured, 0 = student skipped tracking

class _SimStudent:
    def __init__(self, rng):
        aptitude = rng.normal(0.0, 0.7)
        self.theta = np.full(NUM_SKILLS, _START_THETA) + aptitude + rng.normal(0, 0.4, NUM_SKILLS)
        self.focus_mean   = float(rng.uniform(0.35, 0.95))
        self.focus_spread = float(rng.uniform(4.0, 10.0))
        # A student tends to consistently enable or skip webcam tracking (~70% use it).
        self.uses_tracking = rng.random() < 0.7
        self._rng = rng

    def sample_focus(self):
        a = self.focus_mean * self.focus_spread
        b = (1 - self.focus_mean) * self.focus_spread
        return float(np.clip(self._rng.beta(a, b), 0.02, 1.0))

    def effective_theta(self, s):
        t = self.theta[s]
        for p, strength in PREREQUISITES.get(s, []):
            t += _PREREQ_BOOST * strength * _sigmoid(self.theta[p])
        return t

    def p_correct(self, s, focus):
        z = _DISCRIMINATION * (self.effective_theta(s) - 0.0)
        base = _GUESS + (1 - _GUESS - _SLIP) * _sigmoid(z)
        distraction = 1.0 - focus
        return float((1 - 0.5 * distraction) * base + 0.5 * distraction * _GUESS)

    def study(self, s, focus):
        headroom = _THETA_CEILING - self.theta[s]
        self.theta[s] += _LEARN_RATE * focus * _sigmoid(headroom)

def _choose_next_skill(st, rng):
    if rng.random() < 0.2:
        return int(rng.integers(NUM_SKILLS))               # exploration
    unlocked = [s for s in range(NUM_SKILLS)
                if all(_sigmoid(st.theta[p]) >= 0.5
                       for p, strg in PREREQUISITES.get(s, []) if strg >= 0.6)]
    if not unlocked:
        unlocked = [0]
    return min(unlocked, key=lambda s: st.theta[s])        # weakest unlocked

def simulate_student(rng, min_len=30, max_len=80):
    st = _SimStudent(rng)
    L = int(rng.integers(min_len, max_len + 1))
    hist = []
    for _ in range(L):
        s = _choose_next_skill(st, rng)
        true_focus = st.sample_focus()          # physically always exists
        correct = int(rng.random() < st.p_correct(s, true_focus))
        st.study(s, true_focus)                 # learning uses the REAL focus
        # What the SYSTEM records depends on whether tracking was on:
        if st.uses_tracking:
            rec_focus, tracked = round(true_focus, 3), 1
        else:
            rec_focus, tracked = 1.0, 0          # not measured -> neutral / full credit
        hist.append(Interaction(s, correct, rec_focus, tracked))
    return hist

def simulate_dataset(n_students=800, seed=42, min_len=30, max_len=80):
    rng = np.random.default_rng(seed)
    return [simulate_student(rng, min_len, max_len) for _ in range(n_students)]

# quick sanity check: learning should rise, focus should help
_d = simulate_dataset(800, seed=42)
_early = np.mean([np.mean([i.correct for i in s[:len(s)//3]]) for s in _d])
_late  = np.mean([np.mean([i.correct for i in s[-len(s)//3:]]) for s in _d])
_all = [(i.focus, i.correct) for s in _d for i in s if i.tracked]
_f = np.array([a for a, _ in _all]); _c = np.array([b for _, b in _all])
print(f"learning: early={_early:.3f} -> late={_late:.3f}")
print(f"focus (tracked only): hi={_c[_f>=0.7].mean():.3f} lo={_c[_f<0.4].mean():.3f}")
print(f"students={len(_d)}  interactions={sum(len(s) for s in _d)}")
```

---

### Cell 4 — Input encoding: behaviour-aware, tracking optional

**What & why.** The LSTM reads one vector per interaction. The first `2K` slots
are the classic DKT encoding: a one-hot of the skill placed in the *first* half
if the answer was correct, the *second* half if wrong. Then we append **two**
behaviour slots:

- `focus` — the measured focus (0–1);
- `tracked` — 1 if the webcam measured focus, 0 if the student skipped it.

**Why an explicit `tracked` flag** (this is the "students can skip tracking"
requirement): a skipped session is recorded as `focus = 1.0, tracked = 0` — the
student gets **full credit and is never penalized** for opting out. The separate
`tracked` bit lets the model tell "genuinely fully focused" apart from "we
didn't measure," so a student who turns tracking off is treated fairly *and* the
model can still learn a difference if one exists. Tracking stays optional; when
it's on, recommendations get sharper because a lucky distracted guess is
distinguishable from a confident focused answer.

```python
INPUT_DIM = 2 * NUM_SKILLS + 2   # 2K one-hot(skill*correct) + focus + tracked

def encode_step(skill, correct, focus, tracked):
    v = np.zeros(INPUT_DIM, dtype=np.float32)
    if correct:
        v[skill] = 1.0
    else:
        v[NUM_SKILLS + skill] = 1.0
    v[2 * NUM_SKILLS]     = float(np.clip(focus, 0.0, 1.0))
    v[2 * NUM_SKILLS + 1] = float(tracked)
    return v

print("input dim:", INPUT_DIM)
```

---

### Cell 5 — The DKT model (PyTorch LSTM)

**What & why.** One shared LSTM reads the sequence; at each step its hidden
state feeds a linear head that outputs one logit per skill. Sigmoid turns each
logit into `P(next answer on that skill is correct)`. Because a *single*
network sees all skills, it can transfer knowledge across them — the whole point
of going deep instead of one-HMM-per-skill (BKT).

```python
import torch
import torch.nn as nn

HIDDEN_DIM = 64

class DKT(nn.Module):
    def __init__(self, input_dim=INPUT_DIM, hidden=HIDDEN_DIM, num_skills=NUM_SKILLS):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden, batch_first=True)
        self.head = nn.Linear(hidden, num_skills)

    def forward(self, x):                 # x: (batch, seq, input_dim)
        out, _ = self.lstm(x)             # out: (batch, seq, hidden)
        return self.head(out)             # logits: (batch, seq, num_skills)

print(DKT())
```

---

### Cell 6 — Training loop (masked next-step prediction)

**What & why.** The learning objective is **predict the next answer**: at step
*t*, the model's prediction for the skill attempted at step *t+1* is compared to
whether the student actually got it right, with binary cross-entropy. We only
supervise the *attempted* skill each step (gather), and we **mask** padded
timesteps so shorter sequences don't pollute the loss. Adam optimizes; the loss
should fall steadily.

```python
def build_tensors(dataset):
    xs, sks, ys = [], [], []
    for seq in dataset:
        if len(seq) < 2:
            continue
        x  = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in seq[:-1]])
        sk = np.array([i.skill   for i in seq[1:]], dtype=np.int64)
        y  = np.array([i.correct for i in seq[1:]], dtype=np.float32)
        xs.append(x); sks.append(sk); ys.append(y)
    maxlen = max(len(x) for x in xs); B = len(xs)
    X  = np.zeros((B, maxlen, INPUT_DIM), np.float32)
    SK = np.zeros((B, maxlen), np.int64)
    Y  = np.zeros((B, maxlen), np.float32)
    M  = np.zeros((B, maxlen), np.float32)
    for i, (x, sk, y) in enumerate(zip(xs, sks, ys)):
        L = len(x); X[i, :L] = x; SK[i, :L] = sk; Y[i, :L] = y; M[i, :L] = 1.0
    return (torch.from_numpy(X), torch.from_numpy(SK),
            torch.from_numpy(Y), torch.from_numpy(M))

def train_dkt(dataset, epochs=20, batch=32, lr=1e-2, seed=0):
    torch.manual_seed(seed)
    model = DKT()
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    bce = nn.BCEWithLogitsLoss(reduction="none")
    X, SK, Y, M = build_tensors(dataset); n = X.shape[0]
    for ep in range(epochs):
        perm = torch.randperm(n); tot = 0.0
        for s in range(0, n, batch):
            idx = perm[s:s + batch]
            xb, skb, yb, mb = X[idx], SK[idx], Y[idx], M[idx]
            logits = model(xb)                                    # (b, seq, K)
            pred = logits.gather(2, skb.unsqueeze(-1)).squeeze(-1)  # (b, seq)
            loss = (bce(pred, yb) * mb).sum() / mb.sum()
            opt.zero_grad(); loss.backward(); opt.step()
            tot += float(loss) * len(idx)
        print(f"epoch {ep + 1:2d}/{epochs}  loss={tot / n:.4f}")
    return model

data = simulate_dataset(800, seed=42)
train_data, val_data = data[:640], data[640:]     # 80/20 split
model = train_dkt(train_data)
```

---

### Cell 7 — Evaluate (held-out ROC-AUC)

**What & why.** The honest test: on students the model never trained on, how
well does its predicted `P(correct)` rank actual correct vs wrong answers?
**ROC-AUC** measures exactly that — 0.5 is a coin flip, 1.0 is perfect. A number
comfortably above 0.5 (typically ~0.7+) means the model genuinely learned the
patterns and is a real improvement over the flat heuristic.

```python
from sklearn.metrics import roc_auc_score

@torch.no_grad()
def evaluate(model, dataset):
    y_true, y_prob = [], []
    for seq in dataset:
        if len(seq) < 2:
            continue
        x = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in seq[:-1]])
        logits = model(torch.from_numpy(x).unsqueeze(0))[0]     # (seq, K)
        probs = torch.sigmoid(logits).numpy()
        for t, nxt in enumerate(seq[1:]):
            y_true.append(nxt.correct)
            y_prob.append(probs[t, nxt.skill])
    return roc_auc_score(y_true, y_prob)

print(f"Held-out ROC-AUC = {evaluate(model, val_data):.4f}")
```

---

### Cell 8 — Export weights, verify numpy parity, download

**What & why.** The EduFX server runs on CPU with **no torch** — so we export
the trained weights to a plain `.npz` and prove a hand-written numpy LSTM
forward pass reproduces PyTorch's output (the `assert`). This parity check
guards the one subtle risk: PyTorch packs the LSTM gates in the order
(input, forget, cell, output), and the server's numpy code must unpack them the
same way. If parity passes, the ~90 KB `dkt.npz` will behave identically inside
FastAPI. We also save `dkt.pt` (to resume training) and `dkt_meta.json`
(architecture record), then download all three.

```python
def _np_forward(w, seq):
    H = w["W_hh"].shape[1]
    h = np.zeros(H, np.float32); c = np.zeros(H, np.float32)
    for i in seq:
        x = encode_step(i.skill, i.correct, i.focus, i.tracked)
        g = w["W_ih"] @ x + w["b_ih"] + w["W_hh"] @ h + w["b_hh"]
        ii = _sigmoid(g[:H]); f = _sigmoid(g[H:2*H])
        gg = np.tanh(g[2*H:3*H]); o = _sigmoid(g[3*H:4*H])
        c = f * c + ii * gg; h = o * np.tanh(c)
    return _sigmoid(w["W_out"] @ h + w["b_out"])

sd = model.state_dict()
weights = dict(
    W_ih=sd["lstm.weight_ih_l0"].cpu().numpy(), W_hh=sd["lstm.weight_hh_l0"].cpu().numpy(),
    b_ih=sd["lstm.bias_ih_l0"].cpu().numpy(),   b_hh=sd["lstm.bias_hh_l0"].cpu().numpy(),
    W_out=sd["head.weight"].cpu().numpy(),      b_out=sd["head.bias"].cpu().numpy(),
)

# --- parity check: numpy must match torch to ~1e-5 ---
sample = val_data[0]
with torch.no_grad():
    xs = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in sample])
    torch_last = torch.sigmoid(model(torch.from_numpy(xs).unsqueeze(0))[0, -1]).numpy()
np_last = _np_forward(weights, sample)
assert np.allclose(torch_last, np_last, atol=1e-5), "numpy/torch mismatch — do NOT ship"
print("parity OK — max diff:", float(np.abs(torch_last - np_last).max()))

import json
np.savez("dkt.npz", **weights)
torch.save(sd, "dkt.pt")
json.dump({"num_skills": NUM_SKILLS, "input_dim": INPUT_DIM, "hidden_dim": HIDDEN_DIM,
           "encoding": "onehot(skill*correct) 2K + focus + tracked"},
          open("dkt_meta.json", "w"), indent=2)

from google.colab import files
for fn in ("dkt.npz", "dkt.pt", "dkt_meta.json"):
    files.download(fn)
print("done — send these three files back")
```

---

### Hand-off & notes

- Send back `dkt.npz`, `dkt.pt`, `dkt_meta.json`; they go into
  `server/app/ml/artifacts/` and the backend loads `dkt.npz` (numpy, CPU).
- **GPU not required** — this model is ~23k parameters; Colab CPU trains it in a
  minute. GPU is only a "nice to have."
- **BKT** (the interpretable baseline) is pure numpy and trains locally in
  under a second — it does not need this notebook. The DKT above is the deep
  model you asked to train hands-on.

---

## Source: `docs\product\landing-page-plan.md`

# EduFX Landing Page Plan

> The previous landing page was removed on 2026-09-11. This document is the
> content and design contract for the replacement. The root route currently
> redirects to `/login` until the new page is implemented.

## 1. Goal

Explain EduFX in one calm, credible first visit and move a student to the
workspace. The page should feel like an academic product, not a generic AI
marketing template.

The landing page must communicate one promise:

> EduFX uses evidence from a student's performance to recommend the next
> chemistry topic worth studying.

## 2. Audience

### Primary: student

Needs a quick answer to: "What should I study next, and why?"

### Secondary: supervisor or examiner

Needs to see that the system is a real adaptive-learning implementation with
traceable models, retrieval, authentication, and measured evaluation.

The page should serve both audiences without turning the hero into a technical
document. Technical proof belongs below the first action.

## 3. Content Hierarchy

### First viewport

1. EduFX wordmark and a compact sign-in action.
2. A direct headline about adaptive chemistry study.
3. One short sentence explaining performance -> recommendation.
4. Primary action: `Start a diagnostic` or `Open workspace`.
5. Secondary action: `See how it works`.
6. One real, legible product image showing the learning workspace or a chemistry
   study context. Do not use a decorative blur or a fake dashboard screenshot.

Recommended hero copy:

```text
Study chemistry with a next step that makes sense.

EduFX uses diagnostic answers, quiz history, and optional focus signals to guide
you to the next A-Level chemistry topic worth your time.

[Start a diagnostic] [See how it works]
```

### Section 2: the student loop

Show three connected steps with one sentence each:

1. `Place` - answer a 40-question diagnostic across ten S-block subtopics.
2. `Practice` - study level-aware notes and take a targeted quiz.
3. `Return` - use the updated evidence to receive the next recommendation.

The copy must make clear that the student is guided by the system; the student
does not choose arbitrary curriculum content from a large catalogue.

### Section 3: what powers the recommendation

Use a simple evidence-led layout, not four nested cards:

- DKT predicts next-skill performance from the answer sequence.
- BKT is the interpretable fallback.
- Availability sets the amount of work that fits today.
- Rules enforce prerequisites, cooldowns, and safe fallbacks.

Use the phrase `recommendation engine` for the combined system. Do not call BKT
or DKT an autonomous agent.

### Section 4: grounded support

Explain that chemistry notes are stored in Supabase and retrieved before an
explanation is generated. State the current production behavior accurately:

- Azure production uses Groq for text generation.
- Current Azure retrieval uses lexical ranking over stored Supabase chunks.
- Vector retrieval is optional when an embedding provider is configured.

Avoid claiming that Vertex AI or a fine-tuned model is active in the current
production deployment.

### Section 5: measured proof

Present only evidence with context:

| Proof point | Wording |
|---|---|
| DKT | `0.6822 synthetic held-out ROC-AUC` |
| BKT | `0.6569 synthetic held-out ROC-AUC` |
| Fine-tuning | `QLoRA pipeline completed on Colab Enterprise` |
| Assessment | `40 checks across 10 S-block subtopics` |

The word `synthetic` is required beside the DKT/BKT metric. Do not present these
values as classroom accuracy or a guarantee of learning gain.

### Final action

Close with a short invitation to enter the actual product:

```text
Start with what you know. Let the next topic follow from the evidence.

[Open the workspace]
```

## 4. Visual Direction

### Mood

Light, focused, precise, and quietly scientific. Use a warm white canvas,
deep ink text, restrained violet as the action color, and a small amount of
cool blue or mint for data states. Avoid a dark theme, purple gradients, neon
glows, floating blobs, and excessive glassmorphism.

### Image direction

Create or source one authentic bitmap image for the hero:

- an A-Level chemistry desk with visible glassware, notes, and a laptop showing
  a readable EduFX workspace;
- natural daylight and a clean academic setting;
- enough quiet space for text overlay without hiding the subject;
- no fake unreadable UI, no stock-photo watermark, and no dark blur.

Use additional images only when they reveal a real product state or a real
chemistry object. Do not create screenshot-like images with invented metrics.

### Layout

- Maximum content width: approximately 1180-1240px.
- Desktop hero: two balanced columns, text and image aligned to the same top
  and bottom rhythm.
- Sections use full-width bands with one constrained inner layout.
- Cards are reserved for repeated steps or evidence items; never place cards
  inside cards.
- Keep the next section slightly visible below the first viewport.
- Use stable aspect ratios for all image and product-preview regions.

## 5. Responsive Contract

### Mobile

- One-column flow with the headline first and image second.
- Navigation collapses to logo, sign-in, and one menu control.
- Buttons remain full-width or fit on separate lines.
- No horizontal scrolling, clipped text, or overlapping image labels.
- Hero image remains inspectable; do not crop out the chemistry subject.

### Desktop

- Text column must not exceed a readable measure.
- Hero image must remain the dominant product/context signal.
- Navigation, hero copy, actions, and proof row share the same left edge.

## 6. Interaction Contract

- `Start a diagnostic` goes to `/login` when signed out, then follows the
  existing auth callback to self-assessment or dashboard.
- `Open workspace` goes to `/login`, `/diagnostic/self-assessment`, or
  `/dashboard` according to the existing auth state.
- `See how it works` scrolls to the student-loop section.
- Navigation anchors scroll to real sections and have visible focus states.
- No fabricated forms, pricing, testimonials, or notification promises.

## 7. Implementation Stages

### Stage 1: content and image

- approve the copy above;
- create one authentic hero bitmap;
- define color, type, spacing, and image tokens;
- record image source/license in the repository.

### Stage 2: structure

- create a new `LandingPage` component from empty sections;
- implement the auth-aware primary action;
- use semantic headings, landmarks, and links;
- keep the root route public and preserve all protected app routes.

### Stage 3: responsive polish

- test 390px, 768px, 1280px, and 1440px widths;
- verify text wrapping, image crop, focus states, and keyboard navigation;
- remove unused legacy landing CSS after the new component is stable.

### Stage 4: verification

- run TypeScript, Vitest, and production build;
- capture real browser screenshots at desktop and mobile sizes;
- check that the hero image is nonblank and the primary links navigate;
- verify that signed-out and signed-in actions resolve to the correct routes;
- deploy through the normal Azure GitHub Actions workflow only after checks pass.

## 8. Acceptance Checklist

- [ ] Old marketing component is not imported anywhere.
- [ ] Root route renders the new page and does not expose protected data.
- [ ] Hero message is understandable without technical knowledge.
- [ ] Product/chemistry image is authentic and readable.
- [ ] Current Groq, lexical retrieval, DKT/BKT, and QLoRA claims are accurate.
- [ ] No daily-email-reminder or Vertex-production claim appears.
- [ ] Desktop and mobile layouts have no overlap or clipped text.
- [ ] Keyboard focus, reduced motion, alt text, and contrast are verified.
- [ ] All existing frontend tests and production build pass.

---

## Source: `docs\product\ui-details.md`

# EduFX Webpage UI Details

This document describes the current user interface of the EduFX client application based on the implemented Next.js pages and screen components in `client/src`.

## UI Style Overview

- Design style: clean academic dashboard with soft card surfaces, indigo brand accents, rounded panels, and light gradient backgrounds.
- Primary colors:
  - Background canvas: light blue-gray
  - Brand accent: indigo
  - Success: green
  - Warning: amber
  - Danger: red
- Typography:
  - Uses `Inter`
  - Large bold hero headings
  - Medium-weight section headings and labels
- Common visual patterns:
  - Rounded cards with thin borders and soft shadows
  - Pill badges for status and levels
  - Progress bars and focus bars
  - Responsive grid layouts that collapse to one column on smaller screens

## Shared Layout Patterns

### 1. AppShell pages

Used by the main in-app experience.

- Left sidebar contains:
  - EduFX brand mark and product name
  - Navigation links:
    - Dashboard
    - Progress
    - Behaviour Logs
    - Settings
  - "Focus-aware learning" insight card
  - Student identity block with initials, name, email, and reset session button
- Main content area contains:
  - Header with eyebrow label `EduFX workspace`
  - Page title and subtitle
  - Optional action button on the right
  - Main page content inside a large rounded white panel

### 2. AuthShell pages

Used by diagnostic-related pages.

- Split layout with two large panels
- Left hero panel contains:
  - EduFX brandline
  - Big headline
  - Supporting text
  - Progress or completion summary
- Right panel contains:
  - Main interaction area such as question flow or results list

### 3. PageState pages

Used for loading, error, and empty states.

- Centered state card
- Icon + title + message
- Covers situations such as:
  - data loading
  - failed API loads
  - missing content

## Route-by-Route UI Details

## `/`

- Behavior: immediately redirects to `/dashboard`
- No standalone visible homepage UI

## `/login`

- Behavior: immediately redirects to `/dashboard`
- No dedicated login form is currently shown

## `/dashboard`

Main overview page for the student.

- Layout: `AppShell`
- Header:
  - Title: `Dashboard`
  - Subtitle welcomes the student and mentions the adaptive plan
  - Primary action button:
    - `Start first topic` if a plan exists
    - `Open diagnostic` if no plan exists
- Top hero strip:
  - Section label: `Today's route`
  - Shows next recommended topic or `Diagnostic required`
  - Explains that scheduling is based on performance, deadlines, and reinforcement balance
  - Three metric boxes:
    - weak zones
    - advanced topics
    - focus trend
- Four stat cards:
  - Subtopics mastered
  - Average focus
  - Planned today
  - Sessions completed
- Lower two-column section:
  - `Today's study plan`
    - List of planned topics
    - Each item shows:
      - subtopic title
      - group name
      - last quiz percentage
      - lane type
      - progress/focus bar
      - level pill
      - optional `Deadline override` pill
      - `Study` button
    - Empty state includes a `Start diagnostic` button
  - `Level distribution`
    - List of subtopics with:
      - title
      - completed session count
      - compact score bar
      - level pill

## `/diagnostic`

Diagnostic assessment flow.

- Layout: `AuthShell`
- Left hero panel:
  - Pill: `Step 1`
  - Title: `Diagnostic assessment`
  - Copy explains 40 short checks are used to set starting levels
  - Three metrics:
    - answered
    - remaining
    - current
  - Progress bar
  - Answered counter text
- Right interaction panel:
  - Two-column diagnostic layout
  - Left side:
    - `Question map`
    - Current subtopic label
    - Completed count pill
    - 40-button navigator grid
    - Guidance notes about level assignment and completion requirement
  - Right side:
    - Active question card
    - Question number and question text
    - Answered/pending badge
    - Four option cards for A, B, C, D
    - Previous and Next buttons
    - `Submit diagnostic` button
- Interaction behavior:
  - Users can jump to any question using the navigator
  - Submit stays disabled until all questions are answered

## `/diagnostic/results`

Diagnostic completion summary page.

- Layout: `AuthShell`
- Left hero panel:
  - Success pill: `Diagnostic complete`
  - Title: `Your adaptive study map is ready.`
  - Copy explains that each subtopic has been assigned a level
- Right panel:
  - List of subtopic results
  - Each result row shows:
    - subtopic title
    - diagnostic score percent
    - assigned level pill
  - Bottom action button: `Start learning`

## `/progress`

Detailed learning progress page.

- Layout: `AppShell`
- Header:
  - Title: `Progress`
  - Subtitle explains level, score history, and study cadence
- Top stats row:
  - Advanced topics
  - Beginner topics
  - Total sessions
- Main content:
  - Section card: `Learning map`
  - Displays a wide data table with columns:
    - Subtopic
    - Level
    - Last score
    - Sessions
    - Recent trend
  - Each row includes:
    - subtopic name
    - compact progress bar
    - level pill
    - score and session counts

## `/behaviour-logs`

Focus and session behaviour history page.

- Layout: `AppShell`
- Header:
  - Title: `Behaviour logs`
  - Subtitle explains that focus records come from quiz session snapshots
- Main section:
  - Section card: `Recent sessions`
  - Each session item shows:
    - subtopic title
    - focus percentage
    - phone percentage
    - away percentage
    - tracking status pill:
      - `Tracked`
      - `Skipped`

## `/settings`

Account and session control page.

- Layout: `AppShell`
- Header:
  - Title: `Settings`
  - Subtitle: account profile and session controls
- Two cards:
  - `Profile`
    - student name
    - student email
    - note that Google sign-in is handled through Supabase
  - `Session controls`
    - explains reset behavior
    - button: `Reset local session`

## `/study/[id]`

Study content page for a subtopic.

- Layout: `AppShell`
- Header:
  - Title: current subtopic title
  - Subtitle indicates content level and group name
  - Right action button: `Finish reading`
- Two-column content layout:
  - `Study notes`
    - rendered markdown content for the selected subtopic
  - `Session checklist`
    - pill showing current level
    - learning target summary card
    - checklist items:
      - read full note
      - choose webcam tracking
      - repeat attempts use personalized generation
    - green success callout about focus summary and AI explanations
- The `Finish reading` button leads to webcam check before quiz start

## `/webcam-check`

Camera readiness and tracking choice page.

- Layout: `AppShell`
- Header:
  - Title: `Before you begin`
  - Subtitle references the current student and upcoming quiz run
  - Action button: `Start quiz now`
- Two-column layout:
  - `Camera preview`
    - live video preview if enabled and permission granted
    - fallback state if webcam is disabled
    - status pills:
      - camera ready / no live feed
      - tracking enabled / tracking skipped
    - readiness checklist:
      - single learner in frame
      - permission granted
      - privacy-safe local analysis
      - tracking optional
  - `What will be tracked`
    - eye openness and drowsiness
    - looking away and presence
    - phone, talking, and multi-person indicators
    - privacy callout saying only derived focus flags are stored
    - buttons:
      - `Skip tracking`
      - `Enable tracking`

## `/quiz/[id]`

Quiz-taking interface.

- Layout: `AppShell`
- Header:
  - Title: subtopic title
  - Subtitle shows:
    - first manual attempt or personalized repeat quiz
    - total question count
  - Right-side status pill:
    - `Webcam on`
    - `Webcam off`
- Two-column layout:
  - Left navigator panel:
    - `Quiz navigator`
    - progress percentage pill
    - progress bar
    - question number grid
    - metrics:
      - answered count
      - webcam enabled/skipped
      - difficulty lane
  - Right question panel:
    - current question number and text
    - difficulty status pill
    - four answer option cards
    - instruction callout
    - Previous and Next buttons
    - `Submit quiz` button
- Interaction behavior:
  - Users can answer in any order using the navigator
  - Quiz submission waits until every question is answered
  - Webcam tracking can run in the background if enabled

## `/results/[id]`

Post-quiz results and explanation page.

- Layout: `AppShell`
- Header:
  - Title: `Session complete`
  - Subtitle mentions score, focus outcome, and AI explanations
  - Action button: `Back to dashboard`
- Success hero strip:
  - Success pill: `Session review`
  - Headline varies:
    - `Strong session`
    - `Recovery session`
  - Summary copy about combining quiz performance, focus behavior, and review
  - Metric boxes:
    - quiz score
    - focus score
    - level outcome
- Four stat cards:
  - Quiz score
  - Focus score
  - Phone alerts
  - Away alerts
- Lower two-column section:
  - `Behaviour summary`
    - drowsy percentage
    - talking percentage
    - absent percentage
  - `Question review`
    - one card per question attempt
    - shows:
      - question text
      - correct / needs review pill
      - student's answer
      - correct answer
      - AI explanation for wrong answers

## Loading, Error, and Empty States

Several routes use a consistent state-card UI before content is ready.

- Dashboard:
  - loading dashboard plan and progress
  - error if dashboard data fails
- Diagnostic:
  - loading questions
  - error loading diagnostic
  - empty state if no diagnostic questions exist
- Progress:
  - loading learning map
  - error loading progress
- Behaviour logs:
  - loading recent session summaries
  - error loading logs
- Study page:
  - loading study notes
  - error loading content
  - empty state if no content is found
- Quiz page:
  - loading question set
  - error loading quiz
  - empty state if no quiz is found
- Results page:
  - loading result data and explanations
  - error loading results
  - empty state if no session exists

## Responsive Behavior

- Desktop:
  - Sidebar stays on the left
  - Main pages use 2, 3, or 4-column grids
- Tablet and small screens:
  - Shell grids collapse to one column
  - Sidebar becomes stacked rather than sticky
  - Hero sections and metric grids reduce to simpler layouts
  - Navigators reduce column counts for smaller screens

## Current UX Notes

- `/login` is not yet a real authentication UI because it redirects directly to the dashboard.
- The homepage also redirects immediately, so the product currently opens inside the main app flow.
- The diagnostic experience is the most "onboarding-like" flow and visually differs from the rest through the split hero layout.
- Webcam tracking is presented as optional and privacy-safe in the UI.

---

## Source: `docs\qa\api-testing-checklist.md`

# API Testing Checklist

Use this checklist when validating API endpoints manually, with Postman, or
inside automated tests.

## Status Code Checks

- `200` or `201` for successful requests
- `400` for invalid input
- `401` or `403` for authentication or authorization failures
- `404` for missing resources

## Response Body Checks

- Required keys exist
- Values have correct data types
- IDs, timestamps, and arrays are present in the expected shape
- No internal stack traces or raw server errors are exposed

## Schema Validation

- Response follows the documented JSON schema or OpenAPI contract
- Optional fields appear only when expected
- Enum values match allowed values

## Business Rule Checks

- Totals and scores are logically correct
- Ownership rules are respected
- Returned progress belongs to the active student
- Quiz results align with submitted answers
- Model prediction fields or recommendation outputs are reasonable

## Negative Testing

- Missing required field
- Wrong data type
- Invalid token
- Invalid resource ID
- Unsupported HTTP method
- Invalid content type

## Performance Smoke

- Response time stays below a simple threshold such as `1000 ms` for small APIs
- Threshold may be adjusted for real network conditions and cold starts

## Security Basics

- No secrets are exposed
- No stack traces leak into client responses
- No access to another user’s data
- Test only legal demo, local, or approved staging systems

---

## Source: `docs\qa\api-testing-guide.md`

# EduFX API Testing Guide (Manual)

> Current deployed target: Azure Container Apps. The Cloud Run URL mentioned
> in older dated QA records is historical. Use the deployed environment file or
> the current URLs in [Current status and roadmap](../current-status-and-roadmap.md).

This is a real, endpoint-by-endpoint testing guide for the EduFX FastAPI
backend — grounded in the actual routes, request/response models, and auth
rules in this codebase, not generic placeholder examples. Use it to test the
API by hand with `curl`, Postman/Insomnia, or the bundled
[Postman collection](api-testing/edufx-api.postman_collection.json).

For the automated equivalent of this guide (pytest + `TestClient`), see
[automated-api-testing-guide.md](automated-api-testing-guide.md).

## 1. Environments

| Environment | Base URL | Notes |
|---|---|---|
| Local | `http://127.0.0.1:8001` | `cd server && uvicorn app.main:app --reload --port 8001` |
| Deployed (Azure) | `https://edufx-backend.victorioussand-12db2490.centralindia.azurecontainerapps.io` | Live Supabase-backed data — see [environment guidance](#6-environment-guidance-what-is-and-isnt-safe-to-test-against) before writing test data here |

Every response is wrapped in the same envelope:

```json
{ "success": true, "message": "Request completed", "data": { /* ... */ } }
```

Errors use the same shape with `"success": false` and `"data": null`:

```json
{ "success": false, "message": "Student not found", "data": null }
```

## 2. Authentication — the demo-token trick

Most routes accept a bearer token that identifies a student. Real Google
sign-in produces a Supabase-issued JWT, which is awkward to generate by hand
for testing. The backend has a **first-class test path** built in:
`verify_google_token()` (`server/app/core/auth.py`) special-cases any token
starting with `demo:`, in the form:

```
Authorization: Bearer demo:<Display Name>:<email>
```

This works identically against the local server *and* the deployed Azure
backend, on both the memory and Supabase data backends, with no real OAuth
flow involved — it's exactly what the automated integration tests use (see
`server/tests/integration/test_api_flow.py`). Use a unique email per test
run/scenario so you don't collide with other testers' data:

```bash
curl -s -X POST "$BASE_URL/auth/google" \
  -H "Authorization: Bearer demo:QA Tester:qa-tester-001@edufx.demo"
```

```json
{
  "success": true,
  "message": "Request completed",
  "data": {
    "student_id": 42,
    "name": "QA Tester",
    "email": "qa-tester-001@edufx.demo",
    "diagnostic_completed": false,
    "is_admin": false,
    "free_days": [],
    "session_length": "medium",
    "day_session_length": {},
    "next_expected_date": null,
    "current_streak": 0,
    "longest_streak": 0,
    "last_study_date": null
  }
}
```

First call for a new email **creates** the student; subsequent calls with the
same email log back into the same account. Save `student_id` — most other
endpoints take it as a path parameter (the API trusts the path `student_id`
directly rather than deriving it from the token on most routes — see the
[security notes](#7-known-gaps-worth-testing-for) below, this is itself
something worth probing).

### Admin routes

`GET /admin/*` and `PATCH /admin/*` are the only routes that actually check
the bearer token server-side (`require_admin` in `routes/admin.py`) against
a real `role` column on the student record, rather than trusting a path
parameter. A `demo:` token only gets admin access if that email's student row
already has `role = 'admin'` in the database — you can't self-promote via the
demo-token trick.

## 3. Endpoint Reference

### Auth (`/auth`)

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/auth/google` | `Authorization: Bearer demo:<name>:<email>` or a real Supabase JWT | none |
| GET | `/auth/check` | `X-Student-Id: <id>` header | none |

```bash
curl -s "$BASE_URL/auth/check" -H "X-Student-Id: 42"
```

**Negative cases:**
- No `Authorization` header on `/auth/google` → `401`
- No `X-Student-Id` header on `/auth/check` → `422` (FastAPI's own header validation, before the route body runs)

### Diagnostic (`/diagnostic`)

| Method | Path | Body |
|---|---|---|
| GET | `/diagnostic/questions` | none |
| POST | `/diagnostic/submit` | `DiagnosticSubmitRequest` |

`GET /diagnostic/questions` returns 4 questions per subtopic × 10 subtopics
= 40 questions. `POST /diagnostic/submit` **requires all 40 answers** —
this is enforced (see negative case below), and produces a per-subtopic
placement.

```bash
curl -s -X POST "$BASE_URL/diagnostic/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 42,
    "answers": [
      { "question_id": 1, "subtopic_id": 1, "student_answer": "A" }
    ],
    "self_assessments": [
      { "subtopic_id": 1, "rating": "weak" }
    ]
  }'
```

`self_assessments` is optional; `rating: "weak"` is trusted outright and
places that subtopic at `beginner`, while `"confident"` is cross-checked
against the actual quiz score rather than taken at face value.

**Negative cases:**
- Fewer than 40 answers → `422`
- Unknown `student_id` → `4xx`, `success: false`

### Scheduler (`/scheduler`)

| Method | Path |
|---|---|
| GET | `/scheduler/todays-plan/{student_id}` |

Returns 3 recommended subtopics/day (2 "weak" + 1 "strong", per
`compute_priority()` in `app/core/rules.py`, or the ML recommender if
enabled — see [recommender docs](../ml-recommender/recommender-learning-basics.md)).
Requires the diagnostic to be completed first.

### Content (`/content`)

| Method | Path |
|---|---|
| GET | `/content/subtopics` |
| GET | `/content/{subtopic_id}/{student_id}` |

**Important business rule to test around:** content access is gated by the
student's *current adaptive recommendation*, not just "does this subtopic
exist." `ContentService._assert_active_recommendation()` returns `403` if
the requested `subtopic_id` isn't the student's currently unlocked topic —
**even for a subtopic_id that doesn't exist**, because the gate check runs
before the existence check. This is intentional design, not a bug — a good
example of why "test the actual precedence of validation steps," not just
"does bad input 404," matters.

```bash
# 403 even though 9999999 doesn't exist — gating runs first
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/content/9999999/42"
```

### Quiz (`/quiz`)

| Method | Path | Body |
|---|---|---|
| GET | `/quiz/{subtopic_id}/{student_id}` | none |
| POST | `/quiz/generate` | `GenerateQuizRequest` |

First visit to a subtopic returns `stage: "first"` (15 manually-authored
questions). Re-visiting after a completed attempt returns
`stage: "personalized"` with AI/rule-generated questions
(`source: "live-gen"`), prioritized toward previously-wrong concepts.

**Negative case:**
- `subtopic_id` that doesn't exist → `404` (`"Progress not found"`)

### Results (`/results`)

| Method | Path | Body |
|---|---|---|
| POST | `/results/submit-quiz` | `QuizSubmitRequest` |
| GET | `/results/session/{session_id}/{student_id}` | none |

```bash
curl -s -X POST "$BASE_URL/results/submit-quiz" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 42,
    "session_id": 7,
    "subtopic_id": 1,
    "webcam_enabled": false,
    "answers": [ { "question_id": 101, "student_answer": "A" } ]
  }'
```

**Fixed defect, good regression-testing target:** `GET
/results/session/{session_id}/{student_id}` previously did not verify that
`session_id` actually belonged to `student_id` — see
[BUG_RESULTS_002](bug-report-samples.md#bug_results_002) for the full
write-up. It's fixed now (`ResultsService.get_session_results()` returns a
`404` on mismatch), with a regression test at
`server/tests/integration/test_api_negative_cases.py::test_results_session_for_wrong_student_is_rejected`.
Worth re-testing by hand after any future change to that service, since
it's exactly the kind of check that's easy to accidentally remove during a
refactor.

### Explanation (`/explanation`)

| Method | Path |
|---|---|
| GET | `/explanation/{session_id}/{student_id}` |

AI-generated per-question explanations for a completed session. Had the
same ownership-check gap as `/results/session`
([BUG_RESULTS_002](bug-report-samples.md#bug_results_002)), fixed
alongside it.

### Progress (`/progress`)

| Method | Path |
|---|---|
| GET | `/progress/{student_id}` |
| GET | `/progress/{student_id}/{subtopic_id}` |

### Behaviour (`/behaviour`)

| Method | Path | Body |
|---|---|---|
| POST | `/behaviour/save-snapshot` | `BehaviourSnapshotRequest` |
| POST | `/behaviour/save-summary` | `BehaviourSummaryRequest` |
| GET | `/behaviour/session/{session_id}` | none |
| GET | `/behaviour/student/{student_id}` | none |

Percent fields (`phone_percent`, `drowsy_percent`, etc.) sent in
`save-summary` are **advisory only** — the server recomputes them from the
stored per-snapshot flags, so it's a good place to test "does the client
value actually get trusted" (it shouldn't).

### Settings (`/settings`)

| Method | Path | Body |
|---|---|---|
| PUT | `/settings/{student_id}/availability` | `UpdateAvailabilityRequest` |
| POST | `/settings/{student_id}/next-free` | `NextFreeCheckInRequest` |

```bash
curl -s -X PUT "$BASE_URL/settings/42/availability" \
  -H "Content-Type: application/json" \
  -d '{
    "free_days": [1, 3, 5],
    "session_length": "medium",
    "day_session_length": {},
  }'
```

`next-free`'s `choice` field is a `Literal["tomorrow", "in_2_days", "this_weekend", "not_sure"]`
— a good target for enum-boundary negative testing (send `"next week"` and
confirm `422`).

### Teacher (`/teacher`)

| Method | Path | Body |
|---|---|---|
| POST | `/teacher/{student_id}/chat` | `TeacherChatRequest` |
| GET | `/teacher/{student_id}/report` | none |

AI-backed chat; `message` plus optional `history` (oldest-first). Good
target for exploratory testing — very long messages, empty strings, and
non-English input are all reasonable charter items (see
[exploratory-charter.md](manual-testing/exploratory-charter.md)).

### Admin (`/admin`) — the one route group with real auth enforcement

| Method | Path | Auth |
|---|---|---|
| GET | `/admin/students` | `require_admin` |
| GET | `/admin/students/{student_id}` | `require_admin` |
| PATCH | `/admin/students/{student_id}/role` | `require_admin`, body `{"role": "student" \| "admin"}` |

```bash
# 401 — no token at all
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/admin/students"

# 403 — valid demo token, but that email's role isn't "admin" in the DB
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/admin/students" \
  -H "Authorization: Bearer demo:Not Admin:not-admin@edufx.demo"

# 200 — only if this exact email's students.role = 'admin'
curl -s "$BASE_URL/admin/students" \
  -H "Authorization: Bearer demo:Real Admin:your-real-admin-email@example.com"
```

`role` in `PATCH .../role` is a strict `Literal["student", "admin"]` —
sending any other string is a `422` from Pydantic before it reaches the
service, but only *after* the `require_admin` auth check runs (auth is
checked first regardless of body validity — confirm this ordering yourself,
it's a common thing to get backwards).

## 4. Manual Test Case Matrix

| ID | Endpoint | Scenario | Expected |
|---|---|---|---|
| TC_API_AUTH_01 | `POST /auth/google` | Valid demo token, new email | `200`, student created |
| TC_API_AUTH_02 | `POST /auth/google` | Same demo token twice | `200`, same `student_id` both times |
| TC_API_AUTH_03 | `POST /auth/google` | No `Authorization` header | `401` |
| TC_API_DIAG_01 | `POST /diagnostic/submit` | All 40 answers, all correct | `200`, 10 results, each `assigned_level` reflects score |
| TC_API_DIAG_02 | `POST /diagnostic/submit` | 39 answers (one missing) | `422` |
| TC_API_QUIZ_01 | `GET /quiz/{id}/{student}` | First visit, diagnostic done | `200`, `stage: "first"`, 15 questions |
| TC_API_QUIZ_02 | `GET /quiz/{id}/{student}` | Second visit, after a submitted attempt | `200`, `stage: "personalized"`, `source: "live-gen"` |
| TC_API_QUIZ_03 | `GET /quiz/{bad_id}/{student}` | Subtopic id that doesn't exist | `404` |
| TC_API_RESULTS_01 | `POST /results/submit-quiz` | All correct answers | `200`, `quiz_score: 100`, `level_changed` reflects rule |
| TC_API_RESULTS_02 | `GET /results/session/{id}/{other_student}` | Real session, wrong `student_id` | `404` (fixed — see [BUG_RESULTS_002](bug-report-samples.md#bug_results_002)) |
| TC_API_ADMIN_01 | `GET /admin/students` | No token | `401` |
| TC_API_ADMIN_02 | `GET /admin/students` | Non-admin token | `403` |
| TC_API_ADMIN_03 | `PATCH /admin/students/{id}/role` | Non-admin token, `{"role":"admin"}` | `403` (self-promotion blocked) |
| TC_API_ADMIN_04 | `PATCH /admin/students/{id}/role` | Admin token, invalid role string | `422` |
| TC_API_SETTINGS_01 | `PUT /settings/{id}/availability` | `free_days: [1,3,5]` | `200`, echoed back on next `/auth/check` |
| TC_API_SETTINGS_02 | `POST /settings/{id}/next-free` | `choice: "next week"` (not a valid enum value) | `422` |

## 5. Negative & Security Test Ideas

Beyond the [generic API testing checklist](api-testing-checklist.md), these
are specific to how this backend is built:

- **Path-param trust**: nearly every non-admin route trusts `student_id` in
  the URL path directly, without deriving it from the auth token. Test what
  happens when you pass a `student_id` that belongs to someone else on
  every route that takes one as a path param — `/progress`, `/results`,
  `/explanation`, `/behaviour`, `/settings`, `/teacher`. This is the same
  class of bug as [BUG_RESULTS_002](bug-report-samples.md#bug_results_002);
  finding more instances of it is genuinely useful testing, not busywork.
- **Validation-order testing**: as shown with `/content`'s adaptive gate
  running before the existence check, don't assume "invalid resource ID"
  always means "404" — verify the *actual* precedence of checks per route.
- **Enum boundaries**: every `Literal[...]` field in `dto.py` (session
  length, next-free choice, self-assessment rating, admin role) is worth a
  dedicated "send something outside the enum" test.
- **Diagnostic completeness**: the 40-answer requirement is a strict count
  check, not per-question validation — confirm duplicate `question_id`s or
  answers for the wrong `subtopic_id` don't silently pass.
- **Idempotency**: does `POST /auth/google` with the same demo email twice
  create two students, or reuse the first? (Should reuse — confirmed above,
  worth re-verifying after any auth-layer change.)

## 6. Environment Guidance — what is and isn't safe to test against

- **Local** (`memory` data backend, default): fully disposable, resets on
  restart. Best for anything destructive or repetitive.
- **Local against Supabase** (`DATA_BACKEND=supabase` in `.env`): writes
  real rows to the shared dev database. Use clearly-tagged emails
  (`qa-tester-*@edufx.demo`) so real accounts aren't confused with test data.
- **Deployed Azure backend**: same live Supabase project as production.
  Only use `demo:` emails prefixed distinctly (e.g. `qa-*@edufx.demo`) and
  never target real user emails or real student IDs you don't own — this is
  a live system with real (if small-scale) usage.
- **Never** use this guide's examples against a system you don't have
  authorization to test.

## 7. Known Gaps Worth Testing For

This list exists so testing effort finds *real, already-suspected* issues
first rather than starting from zero:

1. **Session/resource ownership isn't consistently enforced everywhere** —
   `/results/session` and `/explanation` had this gap
   ([BUG_RESULTS_002](bug-report-samples.md#bug_results_002), now fixed).
   Other routes that take `student_id` as a path param
   (`/progress`, `/behaviour`, `/settings`, `/teacher`) haven't been
   individually audited for the same pattern — worth checking each one.
2. **Cold-start latency** on Cloud Run or Azure Container Apps (scale-to-zero)
   can make the first
   request after idle noticeably slow — this is expected, not a bug, but
   worth having a documented performance-smoke threshold for (see
   [api-testing-checklist.md](api-testing-checklist.md)) so it isn't
   mistaken for a timeout defect.

---

## Source: `docs\qa\api-testing\EduFX_API_Test_Summary_2026-08-29.md`

# EduFX — Final API Test Summary Report

**Project:** EduFX API Testing System
**SQA Plan:** EduFX SQA Plan – Revised API-Only Scope, v1.1 (29 Aug 2026)
**Test cycle:** API-only, 2-week reduced scope
**Environment under test:** `https://edufx-backend-148945739572.asia-northeast1.run.app` (Cloud Run, `asia-northeast1`)
**API docs:** `/docs` (Swagger UI) · `/openapi.json` (OpenAPI 3.1, title *EduFX MVC API*, 27 paths)
**Execution date (UTC):** 2026-08-29 12:59
**Prepared by:** QA Engineer (senior)
**Tooling:** OpenAPI contract review + scripted HTTP execution (Python `requests`), 3× retry per request, 90 s timeout. Raw evidence in `docs/qa/api-testing/artifacts/` (`test_results.json`, `test_log.csv`).

---

## 1. Executive summary

| Result | Status |
|---|---|
| **Release recommendation** | 🔴 **NOT READY** — a single environment-level defect blocks every data-backed endpoint |
| Exit criteria met | **No** (see §8) |
| Critical defects open | **1** (DEF-001) |
| Planned checks executable this cycle | 73 designed · **43 executed** · **30 blocked** |
| Executed pass rate | 43 / 43 (100%) — *contract, input-validation, authentication-rejection and routing layers only* |
| Functional / business-logic / data-isolation coverage | **0% — could not be exercised** (blocked by DEF-001) |

**Headline finding.** The deployed backend cannot resolve its Supabase database host. Every endpoint that reads or writes data returns **HTTP 500** with the body:

```json
{"success": false, "message": "Unexpected error: [Errno -2] Name or service not known", "data": null}
```

This is a `getaddrinfo` (DNS) failure inside the container — the Supabase project hostname configured in the Cloud Run service either does not resolve, the project is paused/deleted, or egress is misconfigured. `data_backend` is set to `supabase` on this deployment, so there is no in-memory fallback. As a result **15 of the 27 published endpoints have no working success path**, and the remaining functional, positive, boundary, cross-account-isolation and AI-relevance testing defined in the SQA plan **could not be performed**.

What *does* work correctly: the health check, the OpenAPI/Swagger contract, FastAPI request validation (all `422` cases), authentication *rejection* on protected endpoints (`401`), the internal-reminder shared-secret gate (`403`), and HTTP routing/method handling (`404` / `405`).

---

## 2. Environment & entry-criteria assessment

| Entry criterion (SQA §9) | Status | Notes |
|---|---|---|
| API documentation available & matches scope | ✅ Met | `/openapi.json` reachable; 27 paths match the SQA §7 endpoint list 1:1 |
| Test environment running | ⚠️ Partial | Service is up (health `200`) but its database dependency is unreachable |
| Required endpoints accessible | ⚠️ Partial | All routes resolve; 15/27 fail at runtime with `500` |
| Test accounts / tokens / auth details prepared | ✅ Met | `demo:<name>:<email>` bearer tokens accepted by `verify_google_token`; admin role requires a DB-backed `role='admin'` record (unverifiable — DB down) |
| Dummy test data available | ❌ Not met | Data backend unreachable; no seed data could be read or created |
| Test cases reviewed & ready | ✅ Met | 73 checks prepared across 15 areas |

**Conclusion:** entry criteria only partially satisfied. Testing proceeded on the executable subset and the remainder was recorded as **blocked**, per the SQA §14 mitigation for "Test environment or API unavailable".

---

## 3. Execution summary

### 3.1 Overall

| Metric | Value |
|---|---|
| Total checks designed | 73 |
| Executed | 43 |
| Passed | 43 |
| Failed | 0 |
| **Blocked** (DEF-001) | **30** |
| Not run | 0 |
| Executed pass rate | 100% |
| **Planned-scope pass rate** (executed ÷ designed) | **59%** |
| Endpoints with a verified success (2xx) path | **0 / 27** |

> The 100% executed-pass figure must be read with its context: it covers only the layers that sit *in front of* the database (schema validation, auth rejection, routing). No business behaviour was confirmed. The SQA §3 target of ">95% API test case pass rate" and "100% endpoint coverage" is **not achieved** because the majority of cases are blocked, not passed.

### 3.2 By functional area

| Area | Passed | Blocked | Coverage achieved |
|---|---|---|---|
| Health / contract | 5 | 0 | Full |
| Authentication | 5 | 3 | Rejection paths only; login success & `auth/check` blocked |
| Diagnostic | 4 | 2 | Validation only; question list & submit blocked |
| Scheduler (today's plan) | 1 | 2 | Path validation only |
| Content (subtopics / study content) | 1 | 3 | Path validation only |
| Quiz (retrieve / AI generate) | 3 | 2 | Validation only |
| Results (submit / session) | 4 | 2 | Validation only |
| Explanation | 1 | 1 | Path validation only |
| Progress | 2 | 2 | Path validation only |
| Behaviour (snapshot / summary / history) | 4 | 4 | Validation only |
| Settings (availability / next-free) | 4 | 2 | Validation only |
| Teacher (AI chat / report) | 3 | 2 | Validation only |
| Admin (RBAC) | 4 | 2 | Token-absent rejection only; authorised behaviour & `403` for non-admin blocked |
| Internal (reminders) | 2 | 0 | Secret gate verified |
| Cross-account isolation | 0 | 3 | **Not exercised** — see DEF-003 |
| **Total** | **43** | **30** | |

---

## 4. Requirement Traceability Matrix (endpoint coverage)

Legend: ✅ verified · 🟡 partially verified (pre-DB layers only) · ⛔ blocked (no success path) · 🔎 design concern raised

| # | Endpoint | Checks | Outcome |
|---|---|---|---|
| 1 | `GET /` | H-01, H-05 | ✅ health `200`; wrong method `405` |
| 2 | `POST /auth/google` | A-01…A-04 | 🟡 rejects missing/malformed/invalid token (`401`); **⛔ demo-token login → `500`** |
| 3 | `GET /auth/check` | A-05…A-08 | 🟡 header validation `422`; **⛔ lookup → `500`** |
| 4 | `GET /diagnostic/questions` | D-01 | ⛔ `500` |
| 5 | `POST /diagnostic/submit` | D-02…D-06 | 🟡 validation `422` (missing body, missing `student_id`, wrong type, bad `rating` enum); **⛔ valid submit → `500`** |
| 6 | `GET /scheduler/todays-plan/{student_id}` | SC-01…SC-03 | 🟡 non-numeric id `422`; **⛔ valid → `500`** |
| 7 | `GET /content/subtopics` | C-01 | ⛔ `500` |
| 8 | `GET /content/{subtopic_id}/{student_id}` | C-02…C-04 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 9 | `GET /quiz/{subtopic_id}/{student_id}` | Q-01, Q-02 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 10 | `POST /quiz/generate` | Q-03…Q-05 | 🟡 validation `422`; **⛔ valid AI generate → `500`** |
| 11 | `POST /results/submit-quiz` | R-01…R-04 | 🟡 validation `422` (missing body/fields, wrong `answers` type); **⛔ valid submit → `500`** |
| 12 | `GET /results/session/{session_id}/{student_id}` | R-05, R-06 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 13 | `GET /explanation/{session_id}/{student_id}` | E-01, E-02 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 14 | `GET /progress/{student_id}` | P-01, P-02 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 15 | `GET /progress/{student_id}/{subtopic_id}` | P-03, P-04 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 16 | `POST /behaviour/save-snapshot` | B-01…B-03 | 🟡 validation `422`; **⛔ valid save → `500`** |
| 17 | `POST /behaviour/save-summary` | B-04, B-05 | 🟡 validation `422`; **⛔ valid save → `500`** |
| 18 | `GET /behaviour/session/{session_id}` | B-06, B-08 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 19 | `GET /behaviour/student/{student_id}` | B-07 | ⛔ `500` |
| 20 | `PUT /settings/{student_id}/availability` | ST-01…ST-04 | 🟡 validation `422` (missing body/field, bad `session_length` enum); **⛔ valid update → `500`** |
| 21 | `POST /settings/{student_id}/next-free` | ST-05, ST-06 | 🟡 bad `choice` enum `422`; **⛔ valid → `500`** |
| 22 | `POST /teacher/{student_id}/chat` | T-01…T-04 | 🟡 validation `422` (missing body/message, bad history `role`); **⛔ valid chat → `500`** |
| 23 | `GET /teacher/{student_id}/report` | T-05 | ⛔ `500` |
| 24 | `GET /admin/students` | AD-01…AD-03 | 🟡 no token / bad token → `401`; **⛔ non-admin token → `500` instead of `403`** |
| 25 | `GET /admin/students/{student_id}` | AD-04 | 🟡 no token → `401`; authorised path ⛔ blocked |
| 26 | `PATCH /admin/students/{student_id}/role` | AD-05, AD-06 | 🟡 no token → `401`; **⛔ role-enum check unreachable (`500`)** |
| 27 | `POST /internal/reminders/run` | IN-01, IN-02 | ✅ missing secret → `403`; wrong secret → `403` (shared secret **is** configured & enforced) |
| — | Cross-account isolation | IS-01…IS-03 | 🔎⛔ no auth/ownership control in code; behaviour unverifiable (`500`) |
| — | Unknown route / TRACE | H-04 | ✅ `404` / `405` |

---

## 5. Defect log

### DEF-001 — Backend cannot reach its database; all data endpoints return HTTP 500  🔴 Critical

| | |
|---|---|
| **Severity** | Critical (SQA §13: "API unavailable for a core flow" + "an important endpoint repeatedly returns server errors") |
| **Status** | New → Open |
| **Affected** | 15 endpoints directly; 30 planned checks blocked; entire functional test scope |
| **Environment** | Cloud Run `edufx-backend-148945739572.asia-northeast1` |

**Steps to reproduce**
1. `GET https://edufx-backend-148945739572.asia-northeast1.run.app/content/subtopics`
2. Observe `HTTP 500`, body `{"success":false,"message":"Unexpected error: [Errno -2] Name or service not known","data":null}`
3. Repeat for `/progress/1`, `/diagnostic/questions`, `POST /auth/google` (valid `demo:` token), `GET /teacher/1/report`, etc. — identical failure.
4. Retried 6× over ~30 s and across the full run — 100% reproducible, not a cold-start transient.

**Analysis**
`[Errno -2] Name or service not known` is a DNS resolution failure raised when the Supabase client opens its connection. `Settings.data_backend` is `"supabase"` on this deployment and `build_repository_bundle` provides **no in-memory fallback** once that mode is selected, so every repository call fails. Health check (`/`) survives only because it touches no repository.

**Cross-check:** the previous backend URL (`https://edufx-backend-rngcuc5r2a-an.a.run.app`, from the project's Postman environment) shows the **identical** failure on the same endpoints. Both deployments are affected, which points to a **Supabase project-level outage** (project paused, deleted, or free-tier auto-pause) rather than a single bad Cloud Run revision.

**Likely causes (for the dev team — QA does not fix):** Supabase project paused/deleted (most likely, given both URLs fail); `SUPABASE_URL` env var wrong/empty on both revisions; VPC connector / egress settings blocking public DNS.

**Impact:** Students cannot log in, take the diagnostic, load content, take quizzes, see progress, or use the AI teacher. Admin console non-functional. This alone makes the build unshippable.

**Retest scope when fixed:** full re-run of all 30 blocked checks + the functional/boundary/isolation/AI-relevance suites that were never reached.

---

### DEF-002 — Internal exception details leaked in 500 response body  🟠 Medium

| | |
|---|---|
| **Severity** | Medium (SQA §14 mitigation requires "controlled API error responses"; this returns raw internals) |
| **Status** | New → Open |
| **Affected** | Global — `install_error_handlers` generic handler in `app/core/errors.py` |

**Detail.** The catch-all handler returns `f"Unexpected error: {exc}"` to the client. Callers currently receive the literal OS error string `[Errno -2] Name or service not known`, which discloses that the backend depends on an external host and that the failure is DNS-level. A production error contract should return a generic message (e.g. *"A backend service is temporarily unavailable"*) and log the detail server-side only.

**Repro.** Any request in DEF-001 — inspect the `message` field.

---

### DEF-003 — Student data endpoints have no authentication or ownership enforcement  🟠 Medium–High (design)

| | |
|---|---|
| **Severity** | Medium now / **Critical if confirmed live** (SQA §13: "another student's data is exposed") |
| **Status** | New → Open — **behaviour could not be executed (blocked by DEF-001); raised from contract + code review** |
| **Affected** | `/scheduler/todays-plan/{id}`, `/content/{sub}/{id}`, `/quiz/{sub}/{id}`, `/results/*`, `/explanation/*`, `/progress/*`, `/behaviour/*`, `/settings/{id}/*`, `/teacher/{id}/*`, `/auth/check` |

**Detail.** None of these routes take a bearer token or verify the caller against the `student_id` in the path/body/header. Any client that knows or guesses a numeric `student_id` (they are sequential integers) can read another student's progress, quiz results, answer explanations, behaviour/proctoring history, and study settings, and can post behaviour data or chat as them. Cross-account checks IS-01…IS-03 were designed to prove this but returned `500` (DEF-001), so the finding is **unverified against the live API** and must be retested once DEF-001 is resolved. The SQA §14 risk register explicitly calls this out as a Critical risk ("One student accessing another student's data").

**Recommended fix (dev team):** require the Supabase bearer token on all student routes and assert `token.sub → student_id` matches the requested resource.

---

### DEF-004 — CORS allows credentialed requests from any `*.run.app` origin  🟡 Low

| | |
|---|---|
| **Severity** | Low (token is sent in a header, not a cookie, which limits practical impact) |
| **Status** | New → Open |
| **Affected** | `app/core/application.py` CORS middleware |

**Detail.** `allow_origin_regex=r"https://.*\.run\.app"` combined with `allow_credentials=True`. Verified:

```
OPTIONS /progress/1   Origin: https://attacker-abc123.run.app
→ 200, access-control-allow-origin: https://attacker-abc123.run.app
     access-control-allow-credentials: true
```

Any site a third party can deploy to Cloud Run (`*.run.app`) is treated as a trusted browser origin. Tighten the regex to the specific frontend project hostname(s).

---

### DEF-005 — `demo:` bearer token bypasses authentication and is not gated by an environment flag  🟡 Low

| | |
|---|---|
| **Severity** | Low (intended for demos) — raise to Medium for a production release |
| **Status** | New → Open |
| **Affected** | `verify_google_token` in `app/core/auth.py` |

**Detail.** Any request with `Authorization: Bearer demo:<name>:<email>` is accepted as that identity with no credential check (verified: A-04 reached the DB layer, i.e. auth passed). The bypass is **not** guarded by `Settings.demo_mode`, so it cannot be turned off by configuration. It should be disabled (or flag-gated) before any real user data is stored.

---

### Positive observations (no defect)

- **Input validation is solid.** All 20 malformed-request checks returned `422` with a proper `HTTPValidationError` body — missing bodies, missing required fields, wrong scalar types, invalid enum values (`rating`, `session_length`, `choice`, chat `role`), and non-numeric path parameters.
- **Authentication rejection is correct.** `POST /auth/google` and every `/admin/*` route return `401` for missing or malformed `Authorization` headers, before any backend work.
- **Internal reminder endpoint is protected.** `POST /internal/reminders/run` returns `403` for both a missing and an incorrect `x-internal-secret` — the shared secret is configured and enforced on this deployment.
- **Routing & method handling are correct.** Unknown routes `404`; disallowed methods (`POST /`, `HEAD /`, `TRACE /`) `405`.
- **Contract is published and accurate.** `/openapi.json` and `/docs` load; the 27 documented paths match the SQA §7 list exactly.

---

## 6. Defect summary

| Severity | Count | IDs |
|---|---|---|
| Critical | 1 | DEF-001 |
| High | 0 | — |
| Medium | 2 | DEF-002, DEF-003 |
| Low | 2 | DEF-004, DEF-005 |
| **Total** | **5** | |

(DEF-003 is scored Medium pending live retest; it becomes Critical if the missing-isolation behaviour is confirmed once DEF-001 is fixed.)

---

## 7. Risk assessment (against SQA §14)

| Risk | Plan level | Materialised? | Note |
|---|---|---|---|
| Test environment / API unavailable | High | **Yes** | DEF-001 — core mitigation invoked; 30 checks recorded blocked |
| Supabase / Vertex AI dependency failure | High | **Yes** | Supabase unreachable; the plan's required control ("EduFX returns *controlled* API error responses") **fails** — see DEF-002 |
| One student accessing another's data | Critical | **Unverified / likely** | DEF-003 — no isolation control in code; live proof blocked |
| Invalid / missing / expired tokens | High | Mitigated | Rejection paths verified for the endpoints that enforce auth |
| Unstable AI response content | Medium | Not assessed | `/quiz/generate`, `/teacher/*` never returned a success response |
| Requirement / endpoint changes | High | No | Contract matches the plan |

---

## 8. Exit-criteria evaluation (SQA §10)

| Exit criterion | Met? | Evidence |
|---|---|---|
| All planned API test cases executed or clearly marked blocked | ⚠️ Partial | 43 executed, 30 explicitly blocked and traced to DEF-001 |
| No critical defects open | ❌ **No** | DEF-001 open |
| No unresolved high-severity defects blocking agreed flows | ❌ **No** | DEF-001 blocks every core flow |
| Final pass rate > 95% | ❌ **No** | 59% of planned scope; functional behaviour 0% verified |
| All agreed endpoints & requirements have test coverage | ⚠️ Partial | Every endpoint has *designed* coverage; 0/27 have a verified success path |
| Fixed defects retested + focused regression done | ❌ N/A | No fixes delivered this cycle |
| Final summary completed & approved | 🔄 In progress | This document |

**Exit criteria are NOT satisfied. The test cycle closes as BLOCKED.**

---

## 9. Recommendation

🔴 **Not ready for release.**

1. **Dev team — fix DEF-001 first.** Restore the Supabase project / correct `SUPABASE_URL` / fix Cloud Run egress. Until a data endpoint returns `2xx`, no further functional QA is possible. As an interim, consider deploying with `data_backend=memory` so the API is at least demonstrable.
2. **Then hand back for a full functional pass.** QA will re-run the 30 blocked checks plus the positive/boundary/business-logic/cross-account/AI-relevance suites that were never reached (quiz scoring correctness, progress updates, diagnostic level placement, behaviour aggregation, admin RBAC actions, AI chemistry relevance sampling).
3. **Address DEF-003 before storing real student data** — it is the highest-impact design gap and is a Critical risk in the SQA plan.
4. **Fold DEF-002, DEF-004, DEF-005 into the same hardening pass.**

**Estimated QA effort after DEF-001 is fixed:** ~3 days (matches the SQA §16 "API test execution" allocation, which has not yet been consumed).

---

## 10. Deliverables produced this cycle

| SQA §11 deliverable | Status |
|---|---|
| API Test Plan / Scenarios / Cases | ✅ 73 checks across 15 areas (this report §4, `test_log.csv`) |
| Requirement Traceability Matrix | ✅ §4 |
| Bug Reports | ✅ §5 (DEF-001…DEF-005) |
| Test execution evidence | ✅ `docs/qa/api-testing/artifacts/test_results.json`, `test_log.csv` |
| Postman collection / environment | ✅ Exists in repo — `docs/qa/api-testing/edufx-api.postman_collection.json` + `edufx-deployed/local.postman_environment.json`. **Action:** update `base_url` in the deployed environment to `https://edufx-backend-148945739572.asia-northeast1.run.app` (currently points at the older URL). This cycle's execution was scripted (`run_tests.py`) for repeatability; the Postman collection covers the same endpoints for manual re-runs |
| Final API Test Summary Report | ✅ This document |

---

## Appendix A — Full check log

See `docs/qa/api-testing/artifacts/test_log.csv` (73 rows: ID, area, test case, request, expected, actual status, verdict, response excerpt).

## Appendix B — Sign-off

| Role | Name | Decision | Signature | Date |
|---|---|---|---|---|
| QA Engineer | | Cycle closed — BLOCKED, not ready | | |
| Project Supervisor | | | | |

**Accepted / known issues carried forward:** DEF-001 (blocker), DEF-002–005 (hardening backlog).
**Follow-up action:** dev to resolve DEF-001, then request functional re-test.

---

## Source: `docs\qa\automated-api-testing-guide.md`

# EduFX Automated API Testing Guide

> CI validates the application with an in-memory backend. The active deployed
> runtime is Azure Container Apps; GCP Cloud Run is manual legacy infrastructure.

How this project's automated test suite is built, how to run it, and how to
extend it. For the manual/exploratory counterpart, see
[api-testing-guide.md](api-testing-guide.md).

## 1. Stack

| Layer | Tool | Where |
|---|---|---|
| Backend unit tests | `pytest` | `server/tests/unit/*.py` (~24 files) |
| Backend API integration tests | `pytest` + FastAPI `TestClient` | `server/tests/integration/*.py` |
| Frontend component/unit tests | `vitest` + `@testing-library/react` | `client/src/**/*.test.ts(x)` |

The integration tests are the ones most relevant to "API testing" — they run
**the real FastAPI app in-process**, sending real HTTP requests through the
real routing/validation/auth layers, but without a network socket or a
running server. This is the standard way to automate API testing for a
FastAPI backend: fast (no process startup), but exercises the actual HTTP
contract (status codes, JSON shape, header handling), unlike a plain
unit test that calls a service function directly in Python.

## 2. Running the suite

```bash
cd server
pip install -r requirements.txt
python -m pytest tests/ -v                       # everything
python -m pytest tests/integration/ -v            # API-level tests only
python -m pytest tests/unit/ -v                   # service/repository-level tests only
python -m pytest tests/integration/test_api_flow.py -v   # one file
python -m pytest -k "admin" -v                    # anything with "admin" in the test name
```

```bash
cd client
npm install
npx vitest run             # everything, once
npx vitest                 # watch mode
npx vitest run src/features/auth  # one folder
```

`server/tests/conftest.py` forces `DATA_BACKEND=memory` and blanks out any
Supabase/GCP env vars before the app is imported, so **running the suite
never touches real data**, regardless of what's in your local `.env`. This
is the single most important property of this test suite — it's why it's
safe to run repeatedly without worrying about polluting the live Supabase
project the way ad-hoc manual `curl` testing can.

## 3. How the existing suite is structured

### `tests/integration/test_api_flow.py` — the golden path

One `TestClient(app)` instance shared across the file, a `create_student()`
helper that logs in via the `demo:` token trick (see
[api-testing-guide.md §2](api-testing-guide.md#2-authentication--the-demo-token-trick)),
then four tests that walk the **entire real user journey** end-to-end over
real HTTP calls: login → diagnostic → scheduler → content → quiz → behaviour
→ results → explanation → progress. This is a genuine regression safety net
— if any of those nine endpoints break in a way that stops the flow from
completing, this file catches it immediately.

### `tests/integration/test_api_negative_cases.py` — what should fail

The complementary suite: missing auth, missing required fields, invalid
resource IDs, and cross-role access. Written after the happy path was
already green — this is the normal QA order: prove the golden path works,
*then* go looking for what breaks it. Two real bugs were found this way
while building this file — see
[bug-report-samples.md](bug-report-samples.md) for `BUG_QUIZ_002` and
`BUG_RESULTS_002` — both fixed, with the regression tests in this file now
passing rather than left `xfail`.

**A technique worth knowing even though this suite doesn't currently use
it**: `pytest.mark.xfail(reason=..., strict=True)` documents "this should
pass, currently doesn't, here's why" directly in the test suite instead of
only in a bug tracker, when you find a bug you're deliberately *not* fixing
in the same session that found it. The test still runs every CI run; if
someone later fixes the underlying bug as a side effect of unrelated work,
`strict=True` makes the suite **fail** (not silently pass) until the
`xfail` marker itself is removed — forcing a deliberate acknowledgement of
the fix rather than it going unnoticed. `BUG_RESULTS_002` was tracked this
way for a short time in this project's own history before being fixed;
reach for the same pattern any time you triage a bug as "real, but not
today's problem."

### `tests/unit/*.py` — service and repository logic

Each file targets one service or repository in isolation (constructed
directly in Python, no HTTP layer, often against `DemoDataStore` fixtures
or hand-built domain objects) — e.g. `test_admin_service.py`,
`test_rules.py` (the pure scheduling-priority math), `test_ai_service.py`
(provider fallback chain behavior with mocked clients). These are faster
and more precise for testing business logic edge cases than going through
HTTP every time; the integration tests exist to prove the HTTP layer wires
those services together correctly, not to re-test every logic branch.

**Rule of thumb**: if you're testing "does this calculation/rule produce
the right answer," write a unit test. If you're testing "does the API
return the right status code/shape/auth behavior," write an integration
test.

## 4. Writing a new automated API test

Copy the pattern from `test_api_negative_cases.py`:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def create_student(suffix: str = "default") -> int:
    response = client.post(
        "/auth/google",
        headers={"Authorization": f"Bearer demo:Test User:test-{suffix}@edufx.demo"},
    )
    assert response.status_code == 200
    return response.json()["data"]["student_id"]


def test_my_new_scenario():
    student_id = create_student("my-scenario")           # unique suffix — avoids
                                                            # colliding with other tests'
                                                            # data in the shared in-process store
    response = client.get(f"/progress/{student_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] == []                             # fresh student, no progress yet
```

**Things that trip people up the first time:**

- The in-memory `DemoDataStore` is **shared across every test in the same
  pytest process** (it's built once via `get_container()`, which is
  `@lru_cache`d). Student IDs keep incrementing across the whole test run —
  don't assume a fresh student is `student_id == 1`, and always use a
  unique `suffix` per test so `create_student()` calls don't collide.
- `TestClient` re-raises unhandled server-side exceptions into the test
  itself by default (`raise_server_exceptions=True`), rather than returning
  the 500 JSON response a real deployed server would send. This is
  *useful* — it's exactly how `test_api_negative_cases.py` first caught
  the `KeyError` bug in `QuizRepository.get_progress()` for an unknown
  `subtopic_id` (now fixed) — but it means "does this crash" and "does
  this return the JSON 500 body" are different things to test for if you
  specifically care about the latter.
- Prefer asserting on `response.json()["data"]` fields over the full
  response body where practical — DTOs gain optional fields over time, and
  asserting the whole body makes tests brittle for unrelated reasons.

## 5. CI

`.github/workflows/test.yml` runs the full backend `pytest` suite and the
frontend `vitest` suite on every push and pull request (added alongside this
guide — see the workflow file for the exact steps). This is separate from
`.github/workflows/deploy-azure.yml`, which builds and deploys to Azure after a
push to `main`. The deployment workflow performs its own production smoke
checks; `test.yml` is the unit/integration quality gate and should remain green
before a release.

## 6. Automation Coverage Matrix

| Endpoint group | Covered by |
|---|---|
| `/auth/*` | `test_api_flow.py`, `test_api_negative_cases.py` |
| `/diagnostic/*` | `test_api_flow.py`, `test_api_negative_cases.py` |
| `/scheduler/*` | `test_api_flow.py` |
| `/content/*` | `test_api_flow.py`, `test_api_negative_cases.py` |
| `/quiz/*` | `test_api_flow.py`, `test_api_negative_cases.py` |
| `/results/*` | `test_api_flow.py`, `test_api_negative_cases.py` |
| `/explanation/*` | `test_api_flow.py`, `test_api_negative_cases.py` |
| `/progress/*` | `test_api_flow.py` |
| `/behaviour/*` | `test_api_flow.py` |
| `/admin/*` | `test_api_negative_cases.py` (auth gating only — no positive-path test yet, since the memory backend's "first student is admin" bootstrap rule is order-dependent across a shared test run and isn't a safe thing to assert on; see `AdminRepository`/`DemoDataStore.create_student`) |
| `/settings/*` | **Not yet covered** — good first contribution |
| `/teacher/*` | **Not yet covered** — good first contribution (mock the AI provider call, don't hit a real LLM in tests) |
| `/internal/*` | **Not yet covered** — good first contribution |

The three "not yet covered" rows are a reasonable next-work list if you're
using this project to build up a QA automation portfolio incrementally.

---

## Source: `docs\qa\bug-report-samples.md`

# Bug Report Samples

Use this format to log defects clearly and consistently.

## Bug Report Template

| Field | Example |
|---|---|
| Bug ID | `BUG_CART_001` |
| Title | Cart total does not update after quantity change |
| Environment | Chrome 126, Windows 11, staging or demo |
| Steps to Reproduce | 1. Add item to cart 2. Change quantity from 1 to 2 3. Click update |
| Expected Result | Total price should double |
| Actual Result | Total price remains unchanged |
| Severity | Major |
| Priority | High |
| Evidence | Screenshot, video, logs attached |

## EduFX Example Bug Reports

### BUG_QUIZ_001

- Title: Quiz page stays in loading state too long and then fails
- Environment: Chrome on Windows 11, deployed frontend, live backend
- Steps to Reproduce:
  1. Open an EduFX quiz route
  2. Wait for the question payload
  3. Observe the loading skeleton
- Expected Result: Quiz question should load in a reasonable time
- Actual Result: Page stays loading and may end with "Quiz could not load"
- Severity: Major
- Priority: High
- Evidence: Screenshot or browser console log

### BUG_RESULTS_001

- Title: Results page fails when explanation request takes too long
- Environment: Chrome on Windows 11, deployed frontend
- Steps to Reproduce:
  1. Complete a quiz
  2. Open the results page
  3. Wait for explanation data
- Expected Result: Results page should show score and degrade gracefully if explanation is delayed
- Actual Result: Results screen may fail to load fully
- Severity: Major
- Priority: High
- Evidence: Screenshot of error state, network trace

### BUG_QUIZ_002 (real, found and fixed 2026-07-07)

- Title: `GET /quiz/{subtopic_id}/{student_id}` crashes with an unhandled `KeyError` for a subtopic that doesn't exist, instead of a clean `404`
- Environment: Backend integration test suite (`pytest`), memory data backend — same code path runs in the deployed Supabase-backed backend
- Steps to Reproduce:
  1. Log in as any student (`POST /auth/google` with a `demo:` token)
  2. `GET /quiz/9999999/{student_id}` (a subtopic id that doesn't exist)
- Expected Result: `404 Not Found`, matching the same-shaped 404 the sibling `/content/{subtopic_id}/{student_id}` route already returns for the same scenario
- Actual Result (before fix): unhandled `KeyError` in `QuizRepository.get_progress()` — in a real deployed server this is caught by the generic `Exception` handler and returned as a `500` with an unhelpful `"Unexpected error: (2, 9999999)"` message, rather than a proper `404`
- Severity: Minor (no data exposure, but wrong status code and a leaky error message)
- Priority: Medium
- Root cause: `QuizRepository.get_progress()` (`server/app/repositories/quiz_repository.py`) indexed the in-memory progress dict directly instead of checking for the key first, unlike the equivalent `ContentRepository.get_subtopic()` and the Supabase-backed `SupabaseQuizRepository.get_progress()` (which already used `mapper.ensure_one(..., status_code=404)` correctly — only the memory-backend path had the bug)
- Fix: added an explicit key check that raises `EduFXError("Progress not found", status_code=404)`, matching the pattern already used elsewhere in the codebase
- Regression test: `server/tests/integration/test_api_negative_cases.py::test_quiz_for_unknown_subtopic_returns_404`
- Found via: automated negative-path API testing (see [automated-api-testing-guide.md](automated-api-testing-guide.md)) — this is exactly the kind of bug happy-path testing alone never catches

### BUG_RESULTS_002 (real, found and fixed 2026-07-07)

- Title: `GET /results/session/{session_id}/{student_id}` (and the sibling `GET /explanation/{session_id}/{student_id}`) did not verify that the session actually belongs to `student_id`
- Environment: Backend integration test suite (`pytest`); applied identically to the deployed backend before the fix
- Steps to Reproduce:
  1. Student A completes a quiz, producing a `session_id`
  2. Student B calls `GET /results/session/{session_id}/{student_b_id}`
- Expected Result: `404` — student B should not be able to read student A's quiz results
- Actual Result (before fix): `200`, with student A's real quiz score, per-question attempts, and correct answers returned (the response DTO's `student_id` field was just echoed back from the URL, never derived from or checked against the actual session owner)
- Severity: Major (real cross-student data exposure — quiz scores and answer history)
- Priority: High
- Root cause: `ResultsService.get_session_results()` and `ExplanationService.get_explanations()` (`server/app/services/results_service.py`, `explanation_service.py`) fetched the session by `session_id` alone and never compared `session.student_id` to the `student_id` argument
- Fix: both services now raise `EduFXError("Session not found", status_code=404)` immediately after fetching the session if `session.student_id != student_id` — a 404 rather than 403, so an unauthorized caller can't use the response to confirm a `session_id` is real
- Regression tests: `server/tests/integration/test_api_negative_cases.py::test_results_session_for_wrong_student_is_rejected` and `::test_explanation_session_for_wrong_student_is_rejected`
- Found via: automated negative-path API testing while building out this project's QA test suite — this was caught, fixed, and verified *before* the QA docs describing it were published, specifically to avoid publishing exploit details for a live unpatched bug in this public repo
- Still open, tracked separately: most other non-admin routes in this app trust `student_id` path params by design without deriving them from the auth token (see [api-testing-guide.md §7](api-testing-guide.md#7-known-gaps-worth-testing-for)) — this fix covers the two routes found so far, not a systemic redesign of that pattern

### BUG_AUTH_001

- Title: Authentication callback completes but session is not restored
- Environment: Chrome, staging or local auth callback flow
- Steps to Reproduce:
  1. Start login
  2. Complete provider auth
  3. Return to callback route
- Expected Result: User should be redirected into EduFX with an active session
- Actual Result: User sees callback error or is returned to login
- Severity: Critical
- Priority: High
- Evidence: Screenshot and callback URL details

---

## Source: `docs\qa\index.md`

# QA Documentation

This section organizes QA artifacts in a way that looks professional for
portfolio work, team handoff, and viva discussion.

## Core QA Docs

- [QA project structure](qa-project-structure.md)
  Recommended folder layout for each QA mini-project.
- [Test plan](test-plan.md)
  What to test, how to test it, entry/exit criteria, and scope.
- [Test cases](test-cases.md)
  Reusable manual test case format with EduFX examples.
- [Bug report samples](bug-report-samples.md)
  Clear issue logging format — including two real defects found while
  building this project's automated API test suite (one fixed, one open).
- [QA summary report](qa-summary-report.md)
  End-of-cycle testing summary for stakeholders.
- [API testing checklist](api-testing-checklist.md)
  Practical assertions for API functional and negative testing.

## API Testing (grounded in the real EduFX endpoints)

- [API testing guide (manual)](api-testing-guide.md)
  Endpoint-by-endpoint reference for every EduFX route — auth model, real
  `curl` examples, expected responses, negative cases, and a manual test
  case matrix. The primary "how do I test this API by hand" document.
- [Automated API testing guide](automated-api-testing-guide.md)
  How the existing `pytest` + FastAPI `TestClient` suite is built, how to
  run it, how to extend it, and the CI workflow that runs it on every push.
- [Postman collection](api-testing/edufx-api.postman_collection.json) +
  [local](api-testing/edufx-local.postman_environment.json) /
  [deployed](api-testing/edufx-deployed.postman_environment.json)
  environments
  Importable, ready-to-run manual API testing artifacts.

## Manual Testing

- [Exploratory charter](manual-testing/exploratory-charter.md)
  Session-based exploratory testing format for guided bug hunting.

## How To Use This Folder

For a standalone QA project, create a dedicated folder that follows the
structure in [qa-project-structure.md](qa-project-structure.md). Use the
templates in this section as the starting point for that project’s test
documents, bug logs, and execution reports.

---

## Source: `docs\qa\manual-testing\exploratory-charter.md`

# Exploratory Testing Charter

Use this template for a short, focused exploratory session.

## Charter Information

- Session ID:
- Tester:
- Date:
- Feature area:
- Duration:

## Mission

Explore the selected feature to uncover usability issues, logic problems,
unexpected states, and error-handling gaps.

## Example Charter

- Feature area: EduFX quiz and results flow
- Mission: Explore how the quiz behaves under slow responses, refreshes,
  navigation changes, and partial backend failure.

## Test Ideas

- Open the flow from multiple entry points
- Refresh during loading
- Navigate back and forward between pages
- Use invalid or missing route parameters
- Simulate slow network conditions
- Observe UI feedback, recovery, and error messaging

## Observations

- Note unusual delays
- Note inconsistent text or layout issues
- Record whether the system recovers automatically

## Bugs Found

- Bug ID:
- Short title:
- Severity:
- Evidence file:

## Follow-up

- Retest after fix
- Convert recurring findings into formal regression test cases

---

## Source: `docs\qa\qa-project-structure.md`

# QA Project Structure

Use the following layout for each QA mini-project so it looks complete,
organized, and professional.

```text
qa-project-name/
├── README.md
├── docs/
│   ├── test-plan.md
│   ├── test-cases.xlsx or test-cases.md
│   ├── bug-report-samples.md
│   └── qa-summary-report.md
├── manual-testing/
│   ├── exploratory-charter.md
│   └── screenshots/
├── automation/
│   ├── tests/
│   ├── pages/ or page_objects/
│   └── reports/
├── api-testing/
│   ├── postman_collection.json
│   ├── environment.json
│   └── schemas/
└── .github/
    └── workflows/
        └── test.yml
```

## What Each Part Means

`README.md`
: short overview of the application under test, scope, tools used, and how to
run the project.

`docs/`
: planning and reporting area for manual and hybrid QA work.

`manual-testing/`
: exploratory notes, execution evidence, screenshots, and tester observations.

`automation/`
: UI automation scripts, reusable page objects, and generated reports.

`api-testing/`
: Postman collections, environments, example payloads, and response schemas.

`.github/workflows/test.yml`
: CI workflow that runs automation or API checks on push or pull request.

## Recommended README Content

Each QA project README should usually contain:

1. Project title
2. System under test
3. Scope of testing
4. Tools used
5. Folder structure
6. How to run automated tests
7. Summary of key findings

## Notes

- If you do not have Excel, use `test-cases.md` instead of `.xlsx`.
- Keep screenshots and bug evidence named clearly, for example
  `BUG_LOGIN_001-invalid-redirect.png`.
- Keep the QA language consistent across all files: scope, severity, priority,
  pass rate, blocked items, and environment details.

---

## Source: `docs\qa\qa-summary-report.md`

# QA Summary Report

## Purpose

Use this document at the end of a test cycle to summarize execution,
defect status, risks, and release confidence.

## Project

- Project name:
- Build number or commit:
- Test environment:
- QA owner:
- Execution period:

## Scope Covered

- Authentication
- Dashboard
- Diagnostic
- Quiz and results
- Behaviour tracking
- API smoke

## Execution Summary

| Metric | Value |
|---|---|
| Total test cases | |
| Passed | |
| Failed | |
| Blocked | |
| Not run | |
| Pass rate | |

## Defect Summary

| Severity | Count |
|---|---|
| Critical | |
| Major | |
| Minor | |
| Cosmetic | |

## Key Findings

- Example: Quiz loading latency creates user-facing failures in slow backend wake-up conditions.
- Example: Results page should not hard-fail when explanation generation is delayed.
- Example: Google callback flow needs stronger session restore handling.

## Risks and Blockers

- Third-party auth instability
- Cloud cold starts
- Missing test data for edge flows

## Recommendation

- Release ready
- Release ready with known minor issues
- Not ready for release

## Sign-off Notes

Record the final decision, known accepted defects, and any follow-up actions.

---

## Source: `docs\qa\test-cases.md`

# Test Cases

Use this structure for manual test cases when you do not want to maintain an
Excel sheet.

## Manual Test Case Template

| Field | Example |
|---|---|
| Test Case ID | `TC_LOGIN_001` |
| Title | Verify user can login with valid credentials |
| Precondition | User account exists and application is available |
| Steps | 1. Open app 2. Enter username 3. Enter password 4. Click Login |
| Test Data | username: `valid_user`, password: `valid_password` |
| Expected Result | User is redirected to dashboard or home page |
| Actual Result | Fill after execution |
| Status | Pass / Fail / Blocked |
| Priority | High / Medium / Low |

## EduFX Example Cases

### TC_LOGIN_001

- Title: Verify user can login with valid credentials
- Precondition: User account exists and Google auth flow is configured
- Steps:
  1. Open the EduFX login page
  2. Click the sign-in action
  3. Complete the configured authentication flow
  4. Return to EduFX
- Test Data: Valid user account
- Expected Result: User reaches dashboard or diagnostic flow
- Actual Result: Pending execution
- Status: Not run
- Priority: High

### TC_DIAG_001

- Title: Verify diagnostic can be started by a first-time student
- Precondition: Student has not completed diagnostic
- Steps:
  1. Login to EduFX
  2. Open diagnostic
  3. Confirm first question is displayed
  4. Move to the next question
- Test Data: New student profile
- Expected Result: Diagnostic opens and question navigation works
- Actual Result: Pending execution
- Status: Not run
- Priority: High

### TC_QUIZ_001

- Title: Verify quiz page loads questions successfully
- Precondition: Student has an active topic or quiz route
- Steps:
  1. Open the quiz page
  2. Wait for question content
  3. Select an answer
  4. Continue to the next step
- Test Data: Active quiz ID
- Expected Result: Question content appears within acceptable time and accepts input
- Actual Result: Pending execution
- Status: Not run
- Priority: High

### TC_RESULTS_001

- Title: Verify results page shows score and explanation data
- Precondition: A completed quiz attempt exists
- Steps:
  1. Submit a quiz
  2. Open the results page
  3. Review score, explanation, and focus summary
- Test Data: Completed quiz attempt
- Expected Result: Results page loads with performance and explanation details
- Actual Result: Pending execution
- Status: Not run
- Priority: High

---

## Source: `docs\qa\test-plan.md`

# Test Plan

> Current target: Azure Container Apps production. The older Cloud Run
> references in dated QA evidence are historical and are not the active test
> environment. See [Current status and roadmap](../current-status-and-roadmap.md)
> for verified live URLs and route expectations.

## Objective

Define the QA scope, approach, environments, and completion criteria for the
application under test.

## Project Information

- Project name: `EduFX` — adaptive A-Level Chemistry study platform
- Application type: Hybrid — Next.js 15 frontend + FastAPI backend, deployed
  on Azure Container Apps, backed by Supabase Postgres
- Test level: Smoke, functional, exploratory, regression, API (both manual
  and automated — see [api-testing-guide.md](api-testing-guide.md) and
  [automated-api-testing-guide.md](automated-api-testing-guide.md))
- Build or environment: Local (`memory` or `supabase` data backend) and the
  deployed Azure backend/frontend — see
  [environment guidance](api-testing-guide.md#6-environment-guidance-what-is-and-isnt-safe-to-test-against)

## Scope

### In Scope

- Authentication and session flow
- Dashboard and navigation
- Quiz and results workflow
- Webcam or behavioural tracking flow
- API validation for key endpoints

### Out of Scope

- Third-party outages outside team control
- Browser/device combinations not targeted in the project
- Performance testing beyond smoke-level checks unless explicitly included

## Test Types

- Smoke testing
- Functional testing
- Exploratory testing
- Regression testing
- API testing
- Basic compatibility testing

## Test Environment

- OS: Windows 11
- Browser: Chrome latest stable
- Network: Standard broadband
- Backend: Demo or staging API
- Database: Supabase or test fixture dataset

## Entry Criteria

- Build is deployed or available locally
- Test accounts are ready
- Test data is prepared
- Core environment setup is complete

## Exit Criteria

- All high-priority test cases executed
- Critical and blocker defects are resolved or accepted
- QA summary report is completed
- Evidence for major defects is attached

## Risks

- Unstable third-party auth or cloud services
- Limited seed data for some feature paths
- Slow backend warm-up causing false timeout failures

## Deliverables

- Test cases
- Bug reports
- Exploratory notes
- API checklist or Postman evidence
- QA summary report

---

## Source: `README.md`

# EduFX

EduFX is an adaptive A-Level Chemistry learning platform focused on the
S-block syllabus. It combines a Next.js frontend, a layered FastAPI backend,
Supabase persistence, Groq-first Azure generation with optional Gemini/Vertex
legacy providers,
knowledge-tracing recommenders,
and behaviour-aware study signals into one full-stack learning system.

The project is built to demonstrate more than a single model call. EduFX
handles:

- diagnostic placement across 10 chemistry subtopics
- per-subtopic progression with beginner/intermediate/advanced levels
- daily study planning driven by BKT/DKT recommender logic
- AI-generated quizzes with weak-concept targeting
- grounded explanations using retrieval over chemistry notes
- webcam-based focus summaries that feed back into interpretation and planning
- an AI teacher surface for grounded progress coaching

## Why this project exists

EduFX was designed as a serious academic and engineering project rather than a
mock landing page or isolated notebook. The repo demonstrates:

- layered MVC-style backend design
- repository-driven storage abstraction (`memory` and `supabase`)
- end-to-end adaptive learning flow
- ML integration beyond LLM prompting
- production deployment through GitHub Actions and Azure Container Apps

## Core product flow

```text
Student signs in
  -> diagnostic placement
  -> per-subtopic starting levels assigned
  -> daily study plan generated
  -> study content opened at the right level
  -> personalized quiz generated
  -> quiz results + explanations shown
  -> progress, streaks, and behaviour summaries updated
  -> next plan recalculated
```

## Main adaptive systems

### 1. Recommender and scheduling

EduFX separates "what is important?" from "what is realistic today?"

- `RecommenderEngine`
  ranks subtopics using DKT first, BKT second, and deterministic fallback rules
- `SchedulingAgent`
  applies free-day rules, session-length caps, weak/strong balancing, and
  streak tracking

This keeps the ranking logic and product planning logic cleanly separated.

### 2. Quiz generation

The quiz system uses:

- current subtopic
- student level
- weak concepts from prior mistakes
- retrieved study context when needed

Generated quizzes are also checked by a quiz-review LangGraph loop so obviously
invalid answer keys can be filtered or regenerated before students see them.

### 3. Explanations and RAG

Wrong-answer explanations are generated with live model calls and chemistry note
retrieval. EduFX reads chemistry chunks from Supabase and currently ranks them
lexically in Azure production before generating the explanation. Vector ranking
remains available when a compatible embedding provider is configured.

### 4. Teacher agent

EduFX includes a grounded AI teacher that can:

- answer questions about the student's own performance
- summarize progress
- describe weaknesses
- suggest what to improve next

This teacher is read-only and runs over a deterministic student dossier rather
than inventing its own facts.

### 5. Behaviour-aware learning signals

The webcam layer records on-device focus signals such as:

- looking away
- phone presence
- absence from frame

Those signals are summarized and stored as session-level evidence, so a score
is interpreted together with attention quality rather than in isolation.

## Architecture summary

### Frontend

- Next.js 15
- React 19
- TypeScript
- App Router
- feature-based UI structure

Key frontend areas:

- `client/src/app/`
- `client/src/features/`
- `client/src/components/`
- `client/src/lib/`

### Backend

- FastAPI
- Pydantic v2
- layered controllers/services/repositories pattern
- dependency injection container

Key backend areas:

- `server/app/routes/`
- `server/app/controllers/`
- `server/app/services/`
- `server/app/repositories/`
- `server/app/ml/`
- `server/app/agents/`
- `server/app/rag/`

### Storage and AI

- Supabase PostgreSQL
- pgvector for retrieval
- Supabase Auth for Google OAuth and email/password
- Groq-first Azure generation with optional Gemini or Vertex legacy providers
- pgvector retrieval with lexical fallback when embedding providers are unavailable
- optional QLoRA fine-tuned endpoint for quiz generation

## Repository structure

```text
EduFX_MVC/
├── client/        Next.js frontend
├── server/        FastAPI backend
├── shared/        Shared TypeScript contracts
├── infra/         SQL bootstrap, environment examples, helper scripts
├── data/          Note and training data assets
├── docs/          Project documentation library
└── .github/       GitHub Actions workflows
```

## Features

- Google and email/password authentication
- diagnostic assessment and level assignment
- adaptive dashboard and daily scheduler
- level-aware study notes
- personalized quiz flow
- results with AI explanations
- progress tracking
- behaviour log history
- settings and availability management
- AI teacher chat and auto-report
- admin analytics views

## Technology stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | FastAPI, Python 3.12, Pydantic v2 |
| Database | Supabase PostgreSQL |
| Retrieval | Supabase content chunks + lexical production ranking; optional vector ranking |
| AI generation | Groq-first Azure path, optional Gemini/Vertex legacy fallback, optional fine-tuned endpoint |
| Knowledge tracing | BKT, DKT |
| Browser ML | MediaPipe, TensorFlow Lite |
| Deployment | Azure Container Apps (primary), GCP Cloud Run (manual legacy), GitHub Actions |
| Tests | Pytest, Vitest |

## Local development

### Backend

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Frontend

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\client
npm install
npm run dev
```

By default, local frontend development may use the demo-oriented login bypass.
Set `NEXT_PUBLIC_SKIP_LOGIN=false` when you want to exercise the real login flow.

## Environment setup

Environment examples live here:

- [`infra/.env.server.example`](infra/.env.server.example)
- [`infra/.env.client.example`](infra/.env.client.example)

Important backend settings include:

- `DATA_BACKEND`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`
- `VERTEX_MODEL`
- `VERTEX_AI_ENABLED`
- `AI_PROVIDER_ORDER`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GEMINI_API_KEY` (optional legacy text and RAG embedding fallback)
- `EMBEDDING_MODEL`
- `FINETUNED_MODEL_URL` (optional)

Important frontend settings include:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SKIP_LOGIN`

## Database and content bootstrapping

### Seed curriculum and content rows

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
python -m app.tools.seed_supabase --dry-run
python -m app.tools.seed_supabase
```

### Ingest RAG notes

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
python -m app.rag.ingest
```

Vector ingestion needs a configured Vertex or Gemini embedding provider.
Current Azure production can retrieve already stored chunks lexically without
calling a Google embedding service.

## Verification

### Backend

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
python -m compileall app
pytest
```

### Frontend

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\client
npm test
npm run build
```

## Documentation

The repo documentation is organized as a structured library under
[`docs/`](docs/index.md).

Recommended entry points:

- [`docs/current-status-and-roadmap.md`](docs/current-status-and-roadmap.md)
- [`docs/index.md`](docs/index.md)
- [`docs/architecture/architecture-reference.md`](docs/architecture/architecture-reference.md)
- [`docs/getting-started/adaptive-system-learning-guide.md`](docs/getting-started/adaptive-system-learning-guide.md)
- [`docs/getting-started/agent-learning-guide.md`](docs/getting-started/agent-learning-guide.md)
- [`docs/ml-recommender/recommender-learning-basics.md`](docs/ml-recommender/recommender-learning-basics.md)
- [`docs/finetuning/finetune-results.md`](docs/finetuning/finetune-results.md)
- [`docs/deployment/deployment-plan.md`](docs/deployment/deployment-plan.md)
- [`docs/product/landing-page-plan.md`](docs/product/landing-page-plan.md)

## Deployment

EduFX now uses GitHub Actions deployment to Azure Container Apps as the primary
production path, with Google Cloud Run kept as a manual legacy deployment path.

Current production URLs, verified route behavior, known limitations, and the
prioritized delivery plan are recorded in
[`docs/current-status-and-roadmap.md`](docs/current-status-and-roadmap.md).

The Azure deployment path includes:

- Docker builds for frontend and backend
- Azure Container Registry pushes
- Azure Container Apps deploys
- build-time backend-origin injection for same-origin frontend proxying
- secret-backed runtime configuration

See:

- [`docs/deployment/deployment-plan.md`](docs/deployment/deployment-plan.md)
- [`docs/deployment/azure-production.md`](docs/deployment/azure-production.md)
- [`docs/current-status-and-roadmap.md`](docs/current-status-and-roadmap.md)
- [`.github/workflows/`](.github/workflows)

## Notes

- `DATA_BACKEND=memory` allows the app to run without live Supabase data.
- The recommender and teacher systems are intentionally separate.
- The behaviour layer is optional for students and should never block study use.
- Daily email reminders are removed until a production mail provider, consent,
  unsubscribe handling, and delivery monitoring are implemented.
- The trained QLoRA adapter is an available artifact, but its serving endpoint
  is not configured in current Azure production.
- Existing scratch files or private local assets are not part of the tracked app.

---
