# EduFX — Full Architecture Reference

> **A-Level Chemistry adaptive study platform.**  
> Next.js 15 frontend · FastAPI backend · Supabase PostgreSQL · Vertex AI · GCP Cloud Run

---

## Table of Contents

1. [What EduFX Does](#1-what-edufx-does)
2. [Technology Stack](#2-technology-stack)
3. [Top-Level Directory Structure](#3-top-level-directory-structure)
4. [Architecture Pattern — MVC + Repository](#4-architecture-pattern--mvc--repository)
5. [Data Flow — End-to-End Request Lifecycle](#5-data-flow--end-to-end-request-lifecycle)
6. [Authentication Flow](#6-authentication-flow)
7. [Frontend — Client](#7-frontend--client)
8. [Backend — Server](#8-backend--server)
9. [Database Schema](#9-database-schema)
10. [AI / ML Layer](#10-ai--ml-layer)
11. [Behaviour Tracking Layer](#11-behaviour-tracking-layer)
12. [Deployment — GCP Cloud Run](#12-deployment--gcp-cloud-run)
13. [CI/CD Pipeline](#13-cicd-pipeline)
14. [Environment Variables](#14-environment-variables)
15. [API Reference](#15-api-reference)
16. [Key Design Decisions](#16-key-design-decisions)
17. [Pending / In-Progress Work](#17-pending--in-progress-work)

---

## 1. What EduFX Does

EduFX is a **personalized, adaptive A-Level Chemistry tutor** focused on the S-block (Group 1 & 2) unit across 10 subtopics.

### Core learning loop

```
Student signs in
       ↓
Diagnostic test (10 questions)
       ↓
Initial level assigned per subtopic  (beginner / intermediate / advanced)
       ↓
Daily study plan  (scheduler, priority-scored)
       ↓
Read content at their level  →  Take personalized quiz
       ↓
Results + AI explanations for wrong answers
       ↓
Level adjusted  →  Concept mastery tracked  →  Loop repeats
```

### Adaptive personalization

- **Per-subtopic levels** — each of the 10 subtopics has an independent level that rises/falls based on quiz performance.
- **Concept-targeted quizzes** — wrong answers are tagged by concept; next quiz reinforces weak concepts (new wording, not repeats).
- **Priority-scored scheduler** — today's plan ranks subtopics by how overdue they are, current level, and mastery gaps.
- **Optional behaviour awareness** — webcam (MediaPipe face detection + TFLite phone detection) records focus and distraction during sessions; summaries feed back into future planning.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 15 (App Router, React 19) |
| Frontend language | TypeScript |
| Frontend styling | Tailwind CSS + custom CSS variables |
| Frontend tests | Vitest |
| Backend framework | FastAPI (Python 3.12) |
| Backend validation | Pydantic v2 + Pydantic Settings |
| Backend auth | PyJWT[crypto] — ES256 (JWKS) and HS256 |
| Database | Supabase PostgreSQL + pgvector |
| Auth provider | Supabase Auth (Google OAuth PKCE, email/password) |
| AI — text | Google Vertex AI: Gemini 2.5 Flash |
| AI — embeddings | Google Vertex AI: gemini-embedding-001 (384-dim) |
| AI — fine-tuned | Qwen 2.5 7B QLoRA (optional vLLM endpoint) |
| ML — face detection | MediaPipe FaceLandmarker (WASM, in-browser) |
| ML — phone detection | TensorFlow Lite MobileNetV2 (in-browser) |
| Deployment | GCP Cloud Run (asia-northeast1, project responsive-sun-491204-e0) |
| Container registry | GCP Artifact Registry |
| CI/CD | GitHub Actions |

---

## 3. Top-Level Directory Structure

```
EduFX_MVC/
├── client/                 Next.js 15 frontend
├── server/                 FastAPI Python backend
├── shared/                 Shared TypeScript contracts (DTOs)
├── infra/                  Infrastructure: SQL schema, scripts, env examples
│   ├── sql/bootstrap.sql   Full Supabase DDL (tables, RPC, pgvector)
│   └── scripts/            PowerShell run helpers (local dev)
├── data/                   Local notes for RAG ingestion
├── docs/                   Architecture, deployment, fine-tuning docs
├── .github/workflows/      GitHub Actions CI/CD
├── .env                    Local environment (gitignored)
└── .mcp.json               MCP server config (Supabase, Chrome, etc.)
```

---

## 4. Architecture Pattern — MVC + Repository

The backend follows a strict layered architecture. Each layer has one job; nothing skips a layer.

```
HTTP Request
     ↓
  Router          (server/app/routes/)        — URL + HTTP method only
     ↓
  Controller      (server/app/controllers/)   — validates inputs, calls service, calls presenter
     ↓
  Service         (server/app/services/)      — ALL business logic lives here
     ↓
  Repository      (server/app/repositories/)  — ALL data access lives here
     ↓
  Database / AI   (Supabase / Vertex AI)
     ↓
  Presenter       (server/app/presenters/)    — formats the ApiResponse envelope
     ↓
HTTP Response
```

### Why this matters

| Layer | Can it call AI? | Can it touch DB? | Can it do HTTP? |
|---|---|---|---|
| Router | No | No | Yes (FastAPI handler) |
| Controller | No | No | No |
| Service | Yes (via ai_service) | No (via repository) | No |
| Repository | No | Yes | No (except Supabase SDK) |

### Dependency Injection

`server/app/core/container.py` holds a single `Container` instance. All 9 controllers, 11 services, and 16+ repositories are lazy-loaded singletons. FastAPI routes receive them via `Depends(get_container)`.

### Repository pattern — swap backends without changing services

`server/app/core/repository_factory.py` reads `DATA_BACKEND` from env and returns either:
- `memory` — pure in-memory Python dicts (no external services, for demo/testing)
- `supabase` — production Supabase PostgreSQL

Services never know which backend they're talking to — they call a repository that satisfies the contract interface in `server/app/repositories/contracts.py`.

---

## 5. Data Flow — End-to-End Request Lifecycle

### Example: Student takes a quiz

```
Browser (Next.js)
  1. User clicks "Start Quiz" for subtopic "Ionisation Energy"
  2. GET /api/backend/quiz/ionisation-energy/{student_id}
     (same-origin — Next.js rewrites to backend URL at build time)

Next.js Server (proxy)
  3. Rewrite rule forwards to https://edufx-backend-*.run.app/quiz/...

FastAPI Backend
  4. Router: quiz.py → QuizRouter.get_quiz_questions()
  5. Auth: JWT from Authorization header verified via JWKS (ES256)
  6. Controller: quiz_controller.py → calls quiz_service.get_quiz()
  7. Service: quiz_service.py
       a. Calls repository.get_student_progress() → gets current level
       b. Calls repository.get_weak_attempts() → finds wrong-answer concepts
       c. Calls select_weak_concepts() from rules.py → ranks weak concepts
       d. Calls ai_service.generate_quiz_questions(level, weak_concepts)
  8. ai_service.py
       a. Builds prompt with level-appropriate difficulty spread
       b. Embeds weak concepts + sample missed questions
       c. Calls Vertex AI Gemini 2.5 Flash
       d. Parses JSON response → list of QuizQuestion dicts
  9. Repository: stores new questions to Supabase questions table
 10. Presenter: wraps in ApiResponse { success: true, data: QuizPayload }

Browser
 11. QuizScreen renders questions
 12. Student answers → POST /api/backend/results/submit-quiz
 13. ResultsService scores, updates student_progress, saves session_summary
 14. ResultsScreen shows wrong answers + AI explanation (ExplanationService)
```

---

## 6. Authentication Flow

### Google OAuth (PKCE)

```
LoginScreen
  ↓  signInWithGoogle()
supabase.auth.signInWithOAuth({ provider: "google", redirectTo: "/auth/callback" })
  ↓  browser navigates to Google
Google consent screen
  ↓  redirects to /auth/callback?code=...
auth/callback/page.tsx
  ↓  resolveCallbackAccessToken(searchParams, hash, supabase)
      ├── Waits for detectSessionInUrl auto-exchange (race prevention)
      ├── Falls back to manual exchangeCodeForSession if needed
      └── Falls back to getSession() if code was already consumed
  ↓  access_token (ES256 JWT, signed by Supabase JWKS)
AuthProvider.authenticateWithAccessToken(token)
  ↓  POST /api/backend/auth/google  { Authorization: "Bearer <token>" }
FastAPI auth.py
  ↓  verify_google_token()
      ├── Reads alg from JWT header
      ├── ES256 → PyJWKClient fetches {supabase_url}/auth/v1/.well-known/jwks.json
      └── HS256 → verifies with SUPABASE_JWT_SECRET
  ↓  TokenIdentity { email, name, subject }
AuthService.login() → upserts student record in Supabase
  ↓  StudentProfile returned to browser
AuthProvider stores student + token in localStorage
  ↓  router.replace("/diagnostic") or "/dashboard"
```

### Email / Password

```
LoginScreen (mode=signin/signup)
  ↓  signInWithEmail() or signUpWithEmail()
supabase.auth.signInWithPassword / signUp
  ↓  access_token from Supabase session
AuthProvider.authenticateWithAccessToken(token)
  ↓  same backend login flow as above
```

### JWT Algorithm Support

The backend (`server/app/core/auth.py`) supports:
- **ES256** — Supabase's new "JWT Signing Keys" feature (asymmetric, EC P-256, verified via JWKS)
- **HS256** — legacy shared-secret tokens (still in circulation during migration)
- **`demo:name:email`** — synthetic token for demo/local mode (no Supabase required)

---

## 7. Frontend — Client

### Directory structure

```
client/src/
├── app/                    Next.js App Router pages
│   ├── layout.tsx          Root layout (AuthProvider wraps all pages)
│   ├── page.tsx            / → redirects to /dashboard
│   ├── login/page.tsx      Login screen
│   ├── auth/callback/      OAuth callback handler
│   ├── dashboard/          Main dashboard
│   ├── diagnostic/         Diagnostic assessment + results
│   ├── quiz/[id]/          Quiz session (dynamic)
│   ├── results/[id]/       Quiz results (dynamic)
│   ├── study/[id]/         Study content (dynamic)
│   ├── progress/           Progress view
│   ├── settings/           Settings
│   ├── behaviour-logs/     Session history
│   └── webcam-check/       Camera setup
├── features/               Feature-scoped logic + UI
│   ├── auth/               OAuth, session, context, guards
│   ├── diagnostic/         Diagnostic quiz flow
│   ├── quiz/               Quiz taking
│   ├── results/            Results + explanations
│   ├── progress/           Progress visualization
│   ├── study/              Content study
│   ├── dashboard/          Dashboard
│   ├── settings/           Preferences
│   ├── behaviour/          Session log history
│   └── webcam/             Face/phone tracking
├── components/             Shared UI components
│   ├── layout/             AppShell, AuthShell
│   └── ui/                 Button, PageState, StatCard, StatusPill, SectionCard
├── lib/                    Utilities
│   ├── api.ts              Backend API client (8 modules)
│   ├── supabase.ts         Supabase client (PKCE config)
│   ├── constants.ts        API_BASE_URL, storage keys, model paths
│   └── storage.ts          localStorage wrapper
└── types/
    └── contracts.ts        TypeScript types (mirrors server DTOs)
```

### API client (`lib/api.ts`)

All backend calls go through typed modules. On network error, retries 3× with 800ms backoff (handles Cloud Run cold starts).

```typescript
authApi      — POST /auth/google, GET /auth/check
diagnosticApi — GET /diagnostic/questions, POST /diagnostic/submit
schedulerApi  — GET /scheduler/todays-plan/{student_id}
contentApi    — GET /content/subtopics, GET /content/{id}/{student_id}
quizApi       — GET /quiz/{id}/{student_id}, POST /quiz/generate
resultsApi    — POST /results/submit-quiz, GET /results/session/{id}/{student_id}
progressApi   — GET /progress/{student_id}[/{subtopic_id}]
behaviourApi  — POST /behaviour/save-snapshot, POST /behaviour/save-summary, GET /behaviour/...
```

### Same-origin proxy

In production, all API calls go to `/api/backend/*`. Next.js rewrites these to the backend Cloud Run URL at build time. This prevents cross-origin requests from being blocked by privacy browsers (Brave, Firefox strict mode).

```typescript
// next.config.ts
rewrites() {
  return [{ source: "/api/backend/:path*", destination: `${BACKEND_ORIGIN}/:path*` }]
}
```

`BACKEND_ORIGIN` is injected as a Docker build arg during CI/CD so it's baked into the Next.js server bundle.

### Auth context (`features/auth/auth-provider.tsx`)

Single `AuthContext` holds:
- `student: StudentProfile | null` — full profile from backend
- `token: string | null` — raw JWT (sent as Bearer in all API calls)
- `loading: boolean`
- `signInWithGoogle()`, `signInWithEmail()`, `signUpWithEmail()`, `signInDemo()`, `signOut()`
- `authenticateWithAccessToken()` — called after any successful Supabase auth
- `refreshStatus()` — re-checks diagnostic_completed flag

Session is persisted to localStorage. On reload, the stored student + token bypass Supabase re-auth. An idle timer (30 min) triggers automatic sign-out.

---

## 8. Backend — Server

### Directory structure

```
server/app/
├── main.py                 Entry: from app.core.application import create_app
├── core/
│   ├── application.py      FastAPI factory, CORS, error handlers, 9 routers
│   ├── config.py           Pydantic Settings (all env vars)
│   ├── auth.py             JWT verification (ES256/HS256/demo)
│   ├── rules.py            Pure business rules (levels, mastery, scoring)
│   ├── errors.py           EduFXError + FastAPI exception handler
│   ├── container.py        Dependency injection container
│   ├── repository_factory.py  Selects memory or Supabase backend
│   ├── store.py            In-memory demo data (curriculum, questions)
│   └── clients.py          Supabase + Vertex AI client init
├── models/
│   ├── domain.py           Core dataclasses (Student, Question, Progress, etc.)
│   └── dto.py              Pydantic request/response shapes
├── controllers/            9 thin orchestrators — one per domain
├── services/               11 service files — all business logic
├── repositories/           16 files — memory + Supabase backends
├── routes/                 9 route files — URL registration only
├── presenters/
│   └── response_presenter.py  ApiResponse envelope (success/error)
└── rag/
    ├── embedder.py         Vertex AI embedding wrapper
    ├── ingest.py           Content chunk creation + bulk embedding
    └── retriever.py        Vector similarity search (Supabase RPC)
```

### Services

| Service | Responsibility |
|---|---|
| `auth_service.py` | Validate JWT, upsert student in DB |
| `diagnostic_service.py` | Score diagnostic answers, assign initial levels |
| `ml/recommender_engine.py` | **Model layer** — rank *what* to study (BKT/DKT or rule fallback), uncapped |
| `scheduling_agent.py` | **Deterministic planning agent** — cap the ranking to the student's free time, own streaks |
| `teacher_service.py` | **Teacher-agent service** — builds dossier and runs LangGraph teacher flows |
| `settings_service.py` | Capture availability + post-session "next free" check-in |
| `reminder_service.py` | Duolingo-style daily nudges (in-app + email) |
| `content_service.py` | Fetch level-appropriate content for a subtopic |
| `quiz_service.py` | Generate personalized quiz (AI or fallback) |
| `results_service.py` | Score quiz, update progress, record session |
| `explanation_service.py` | AI explanation + RAG retrieval per wrong answer |
| `progress_service.py` | Read per-student or per-subtopic progress |
| `behaviour_service.py` | Store snapshots, compute session behaviour summary |
| `ai_service.py` | Vertex AI prompt builders + optional vLLM fine-tune |
| `contracts.py` | Protocol interfaces (for type checking) |

### Agent split

EduFX now has two distinct agent styles:

- **Deterministic agent**:
  `SchedulingAgent` in `services/` owns practical study-plan decisions and
  streak state.
- **LangGraph agents**:
  `server/app/agents/teacher_graph.py` and
  `server/app/agents/quiz_review.py` use grounded LLM flows for student
  coaching and MCQ quality review.

That means "agent" in this repo does not refer to only one implementation
pattern.

### Rules layer (`core/rules.py`)

Pure functions — no I/O, fully testable:
- `assign_level(correct, total)` — beginner / intermediate / advanced
- `should_advance(streak)` / `should_demote(wrong_streak)` — level transitions
- `level_difficulty_spread(level)` → `(easy, medium, hard)` tuple for quiz generation
- `select_weak_concepts(attempts)` — groups attempts by concept, computes accuracy + recent streak, returns weak concepts ordered by severity
- `priority_score(progress, days_since)` — scheduler ranking
- `compute_focus_score(snapshots)` — behaviour focus metric

---

## 9. Database Schema

All tables live in Supabase PostgreSQL. Schema defined in `infra/sql/bootstrap.sql`.

### Tables

#### `students`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
email         text UNIQUE NOT NULL
name          text NOT NULL
diagnostic_completed  boolean DEFAULT false
created_at    timestamptz DEFAULT now()
```

#### `subtopics`
```sql
id            text PRIMARY KEY   -- e.g. "group1-reactions"
name          text NOT NULL
description   text
order_index   int
```

#### `content`
```sql
id            uuid PRIMARY KEY
subtopic_id   text REFERENCES subtopics
level         text  -- beginner / intermediate / advanced
title         text
body          text
```

#### `questions`
```sql
id            uuid PRIMARY KEY
subtopic_id   text REFERENCES subtopics
text          text NOT NULL
options       jsonb NOT NULL          -- list of 4 strings
correct_answer text NOT NULL
explanation   text
difficulty    text                    -- easy / medium / hard
source        text                    -- ai / manual / seeded
stage         text                    -- diagnostic / first / personalized
student_id    uuid REFERENCES students  -- null = shared question
is_diagnostic boolean DEFAULT false
concept       text                    -- concept slug for mastery tracking
```

#### `student_progress`
```sql
student_id    uuid REFERENCES students
subtopic_id   text REFERENCES subtopics
current_level text DEFAULT 'beginner'
PRIMARY KEY (student_id, subtopic_id)
```

#### `session_summary`
```sql
id            uuid PRIMARY KEY
student_id    uuid REFERENCES students
subtopic_id   text REFERENCES subtopics
score         int
total         int
level_before  text
level_after   text
created_at    timestamptz DEFAULT now()
```

#### `quiz_attempts`
```sql
id            uuid PRIMARY KEY
session_id    uuid REFERENCES session_summary
student_id    uuid REFERENCES students
question_id   uuid REFERENCES questions
subtopic_id   text REFERENCES subtopics
student_answer text
correct_answer text
is_correct    boolean
explanation   text
```

#### `behaviour_logs`
```sql
id            uuid PRIMARY KEY
student_id    uuid REFERENCES students
session_id    uuid REFERENCES session_summary
focus_score   float
phone_detected boolean
looking_away  boolean
snapshot_at   timestamptz DEFAULT now()
```

#### `content_chunks` (RAG)
```sql
id            bigint generated always as identity primary key
subtopic_id   bigint REFERENCES subtopics
source        text
chunk_text    text NOT NULL
embedding     vector(384)     -- pgvector
```

#### `match_content_chunks` RPC
```sql
-- Vector similarity search, scoped to one subtopic
CREATE OR REPLACE FUNCTION match_content_chunks(
  query_embedding   vector(384),
  match_subtopic_id bigint,
  match_count       int default 5
) RETURNS TABLE (id bigint, chunk_text text, similarity float)
-- ORDER BY embedding <=> query_embedding (cosine distance)
```

> Retrieval embeds the **query** with `task_type=RETRIEVAL_QUERY` while ingest
> embeds **chunks** with `RETRIEVAL_DOCUMENT` — the two sides must use matching
> task types or similarity scores degrade.

---

## 10. AI / ML Layer

### Vertex AI (production)

`server/app/services/ai_service.py` wraps two Vertex AI capabilities:

**Quiz generation (`generate_quiz_questions`)**
- Model: Gemini 2.5 Flash
- Inputs: subtopic, student level, weak concepts (from `select_weak_concepts`)
- Difficulty spread: level-aware (beginner=8/5/2, intermediate=4/7/4, advanced=2/5/8)
- Weak-concept targeting: ~65% of questions reinforce the student's weakest concepts with new wording; ~35% broad coverage
- Output: JSON array of `{text, options, correct_answer, explanation, difficulty, concept}`
- Post-processing safety: generated MCQs can be checked by the LangGraph
  `quiz_review` loop before they are returned to a student

**Explanation generation (`generate_explanation`)**
- For each wrong answer in a session
- Optional RAG context: retriever pulls relevant content chunks via pgvector similarity search
- Prompt includes: wrong question, student's answer, correct answer, retrieved chunks

### RAG pipeline (`server/app/rag/`)

```
Content notes (data/*.md or CSV)
       ↓
ingest.py — splits into ~300-token chunks
       ↓
embedder.py — Vertex AI gemini-embedding-001 (384 dimensions)
       ↓
Supabase content_chunks table (pgvector)
       ↓
retriever.py — match_content_chunks RPC (cosine similarity)
       ↓
ExplanationService — includes top-k chunks in Gemini prompt
```

### Fine-tuned model (optional)

`FINETUNED_MODEL_URL` env var points to a vLLM endpoint hosting the Qwen 2.5 7B QLoRA adapter. When set, `ai_service.py` routes explanation requests to the fine-tuned model rather than Gemini. Quiz generation stays on Gemini.

Training: QLoRA on Colab Enterprise L4, ChatML format, on domain-specific A-Level chemistry Q&A pairs.

### LangGraph agent layer (`server/app/agents/`)

| File | Purpose |
|---|---|
| `dossier.py` | Build deterministic grounded student snapshot for teacher prompts |
| `teacher_graph.py` | Supervisor-style teacher graph with analyst, diagnostician, coach, synthesis, grounding guard |
| `quiz_review.py` | Verify -> regenerate loop for checking generated MCQ validity |
| `prompts.py` | Shared system prompts for teacher specialists and quiz reviewer |

Teacher endpoints:

- `POST /teacher/{student_id}/chat`
- `GET /teacher/{student_id}/report`

The teacher graph is read-only and never touches scheduling.
The quiz review graph is a safety layer inside quiz generation.

### In-browser ML (`client/src/features/webcam/`)

| File | Purpose |
|---|---|
| `face-tracker.ts` | MediaPipe FaceLandmarker — detects whether student face is visible and looking at screen |
| `phone-detector.ts` | TFLite MobileNetV2 — classifies whether phone is visible in webcam frame |
| `behaviour-tracker.ts` | Aggregates face + phone signals → focus score per snapshot |
| `use-webcam-tracker.ts` | React hook — manages webcam stream, fires snapshot every N seconds |

Snapshots sent to `POST /behaviour/save-snapshot`. On session end, `POST /behaviour/save-summary` triggers server-side aggregation.

---

## 11. Behaviour Tracking Layer

### Data flow

```
Webcam (browser)
  ↓ every 10s
face-tracker.ts → { faceVisible, lookingAway }
phone-detector.ts → { phoneDetected, confidence }
behaviour-tracker.ts → { focusScore: 0–1, phoneProbability }
  ↓
POST /behaviour/save-snapshot
  ↓
BehaviourRepository.save_snapshot() → behaviour_logs table
  ↓ (on quiz/study session end)
POST /behaviour/save-summary
  ↓
BehaviourService.compute_session_summary()
  rules.compute_focus_score(snapshots) → session focus %
  ↓
GET /behaviour/student/{student_id} → HistoryScreen
```

### Current state

The phone detection `phone_detected` flag in snapshots is populated by the TFLite in-browser model (MobileNetV2). Integration is complete at the API level; the in-browser model calls the detector and sends `phone_detected: true/false` per snapshot.

---

## 12. Deployment — GCP Cloud Run

### Services

| Service | URL | Purpose |
|---|---|---|
| `edufx-backend` | `https://edufx-backend-rngcuc5r2a-an.a.run.app` | FastAPI API |
| `edufx-frontend` | `https://edufx-frontend-rngcuc5r2a-an.a.run.app` | Next.js app |

Both run in `asia-northeast1`. Both scale to 0 (min-instances=0) — cold starts take ~2–3s (handled by 3× retry in `api.ts`).

### Why two separate Cloud Run services?

The frontend and backend must be deployed independently (different runtimes, different secrets, different scale parameters). They communicate via the same-origin proxy — the browser never talks directly to the backend URL.

### Network flow

```
Browser
  ↓  HTTPS
Cloud Run: edufx-frontend (Next.js)
  ↓  Next.js rewrite rule (/api/backend/* → BACKEND_ORIGIN/*)
Cloud Run: edufx-backend (FastAPI)
  ↓  Supabase SDK / Vertex AI SDK
Supabase (DB + Auth JWKS)
Google Vertex AI (Gemini)
```

### Dockerfiles

**Backend** (`server/Dockerfile`):
```
python:3.12-slim
COPY requirements.txt → pip install
COPY app/ → uvicorn app.main:app --host 0.0.0.0 --port 8080
```

**Frontend** (`client/Dockerfile`):
```
node:20 (builder)
  ARG NEXT_PUBLIC_SUPABASE_URL
  ARG NEXT_PUBLIC_SUPABASE_ANON_KEY   ← must be the publishable key (sb_publishable_*)
  ARG BACKEND_ORIGIN                  ← baked into Next.js server for rewrite rules
  npm ci && npm run build (standalone)
node:20 (runner)
  COPY .next/standalone + static
  node server.js
```

---

## 13. CI/CD Pipeline

`.github/workflows/deploy.yml` — triggers on push to `main` or manual dispatch.

### Job 1: `deploy-backend`

1. Checkout, GCP auth, configure Docker for Artifact Registry
2. `docker build -t {registry}/{project}/edufx/edufx-backend:{sha} ./server`
3. `docker push`
4. `gcloud run deploy edufx-backend` with all env vars from GitHub secrets
5. Outputs: `url` (backend Cloud Run URL)

Backend env vars (from GitHub Secrets):
```
SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, VERTEX_MODEL, EMBEDDING_MODEL
DATA_BACKEND=supabase, DEMO_MODE=false
FINETUNED_MODEL_URL, FINETUNED_MODEL_NAME
FRONTEND_ORIGIN (initially from FRONTEND_URL secret, updated in job 3)
```

### Job 2: `deploy-frontend` (depends on deploy-backend)

1. `docker build` with build args:
   - `NEXT_PUBLIC_API_BASE_URL=/api/backend` (same-origin, not backend URL)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key only)
   - `BACKEND_ORIGIN=${{ needs.deploy-backend.outputs.url }}` (baked for rewrite rule)
2. `docker push`
3. `gcloud run deploy edufx-frontend`

### Job 3: `sync-backend-origin` (depends on both)

Updates backend's `FRONTEND_ORIGIN` env var to the live frontend URL (for CORS). Runs after frontend deploy so the URL is known.

### GitHub Secrets required

| Secret | Value |
|---|---|
| `GCP_SA_KEY` | GCP service account JSON |
| `GCP_PROJECT_ID` | `responsive-sun-491204-e0` |
| `SUPABASE_URL` | `https://marvtabsezuiwfqhcwcb.supabase.co` |
| `SUPABASE_KEY` | Service role key (backend only, `sb_secret_*`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `SUPABASE_JWT_SECRET` | HS256 fallback secret |
| `SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_*`) — frontend only |
| `FRONTEND_URL` | Frontend Cloud Run URL (for initial CORS seed) |
| `FINETUNED_MODEL_URL` | vLLM endpoint (optional) |

---

## 14. Environment Variables

### Backend (`.env` or Cloud Run env vars)

```env
DATA_BACKEND=memory|supabase
SUPABASE_URL=https://marvtabsezuiwfqhcwcb.supabase.co
SUPABASE_KEY=<service role key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SUPABASE_JWT_SECRET=<hs256 shared secret>
GOOGLE_CLOUD_PROJECT=responsive-sun-491204-e0
GOOGLE_CLOUD_LOCATION=global
VERTEX_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=384
DEMO_MODE=false
FINETUNED_MODEL_URL=          # optional vLLM endpoint
FINETUNED_MODEL_NAME=edufx
FRONTEND_ORIGIN=https://edufx-frontend-rngcuc5r2a-an.a.run.app
```

### Frontend (build args + runtime)

```env
NEXT_PUBLIC_API_BASE_URL=/api/backend            # production: relative (proxy)
                                                  # dev: http://127.0.0.1:8001
NEXT_PUBLIC_SUPABASE_URL=https://marvtabsezuiwfqhcwcb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_... # public key only
NEXT_PUBLIC_SKIP_LOGIN=false                      # true = auto-demo mode
BACKEND_ORIGIN=https://edufx-backend-...run.app  # baked at build for rewrite
```

---

## 15. API Reference

Base URL (production): `https://edufx-frontend-rngcuc5r2a-an.a.run.app/api/backend`  
Base URL (local): `http://127.0.0.1:8001`

All responses wrapped in `ApiResponse<T>`:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message" }
```

All protected endpoints require `Authorization: Bearer <jwt>`.

### Auth

| Method | Path | Body / Params | Returns |
|---|---|---|---|
| `POST` | `/auth/google` | Bearer token in header | `StudentProfile` |
| `GET` | `/auth/check` | `?student_id=` | `{ diagnostic_completed }` |

### Diagnostic

| Method | Path | Returns |
|---|---|---|
| `GET` | `/diagnostic/questions` | `DiagnosticQuestion[]` |
| `POST` | `/diagnostic/submit` | `DiagnosticResult` (levels per subtopic) |

### Scheduler

| Method | Path | Returns |
|---|---|---|
| `GET` | `/scheduler/todays-plan/{student_id}` | `StudyPlanItem[]` (priority-ranked) |

### Content

| Method | Path | Returns |
|---|---|---|
| `GET` | `/content/subtopics` | `Subtopic[]` |
| `GET` | `/content/{subtopic_id}/{student_id}` | `ContentItem` (level-matched) |

### Quiz

| Method | Path | Returns |
|---|---|---|
| `GET` | `/quiz/{subtopic_id}/{student_id}` | `QuizPayload` (questions) |
| `POST` | `/quiz/generate` | `QuizPayload` (AI-generated, concept-targeted) |

### Results

| Method | Path | Returns |
|---|---|---|
| `POST` | `/results/submit-quiz` | `SessionSummary` |
| `GET` | `/results/session/{session_id}/{student_id}` | `SessionDetail` |

### Explanation

| Method | Path | Returns |
|---|---|---|
| `GET` | `/explanation/{session_id}/{student_id}` | `ExplanationMap` (per question) |

### Progress

| Method | Path | Returns |
|---|---|---|
| `GET` | `/progress/{student_id}` | `Progress[]` (all subtopics) |
| `GET` | `/progress/{student_id}/{subtopic_id}` | `SubtopicProgress` |

### Behaviour

| Method | Path | Returns |
|---|---|---|
| `POST` | `/behaviour/save-snapshot` | `{ ok: true }` |
| `POST` | `/behaviour/save-summary` | `BehaviourSummary` |
| `GET` | `/behaviour/session/{session_id}` | `BehaviourLog[]` |
| `GET` | `/behaviour/student/{student_id}` | `BehaviourHistory[]` |

---

## 16. Key Design Decisions

### Same-origin proxy instead of CORS

Privacy browsers (Brave) block cross-origin requests even with correct CORS headers. The Next.js rewrite bakes the backend URL at build time and forwards all `/api/backend/*` calls server-side. The browser only ever talks to the same origin.

### JWT algorithm flexibility (ES256 + HS256)

Supabase migrated to ES256 asymmetric signing (JWKS endpoint). The backend reads `alg` from the token header and routes accordingly — no config change needed if Supabase changes keys again.

### Dual backend (memory + Supabase)

`DATA_BACKEND=memory` runs entirely in-process with no external dependencies. Useful for local development, CI tests, and demo deployments. All repository contracts are identical — switching is a single env var.

### Concept-level mastery (derived, not stored)

`questions.concept` is a slug on each question. Mastery is computed on-the-fly by joining `quiz_attempts → questions.concept` — the last 2 correct answers on a concept = mastered. No separate mastery table to go stale.

### Cold-start retry

Cloud Run scales to 0. The API client retries network errors 3× with 800ms backoff before surfacing an error to the user.

### Auto-bootstrap demo mode

`NEXT_PUBLIC_SKIP_LOGIN=true` (or anything not `"false"`) causes `AuthProvider` to auto-sign in a demo student with a synthetic `demo:name:email` token. The backend recognizes and validates these tokens without Supabase.

---

## 17. Pending / In-Progress Work

| Area | Status | Notes |
|---|---|---|
| Concept-mastery quiz targeting | Planned | Plan at `C:\Users\thano\.claude\plans\sleepy-nibbling-kazoo.md` |
| RLS policies | Not started | 9 tables, all currently open |
| Real A-Level questions | Partial | 590 in DB, many auto-generated |
| RAG content ingest | Not started | `data/` folder + `rag/ingest.py` ready |
| Fine-tuned model (vLLM) | Adapter saved | Needs GCE T4 VM + `FINETUNED_MODEL_URL` secret |
| Phone detection (real model) | In-browser complete | `phone_detected` flag wired end-to-end |
| Supabase Email provider | Needs dashboard | Authentication → Providers → Email |
| Google OAuth redirect URL | Needs dashboard | Add `/auth/callback` to Supabase URL config |
| `FRONTEND_URL` GitHub secret | Add after confirm | Needed for initial CORS seed |
