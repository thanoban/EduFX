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
