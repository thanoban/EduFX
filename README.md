# EduFX

EduFX is an adaptive A-Level Chemistry learning platform focused on the
S-block syllabus. It combines a Next.js frontend, a layered FastAPI backend,
Supabase persistence, Vertex AI generation, knowledge-tracing recommenders,
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
- production-style deployment through GitHub Actions and Cloud Run

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
retrieval. EduFX stores embedded note chunks and retrieves relevant context
before generating the explanation.

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
- Vertex AI Gemini for generation
- Vertex embeddings for RAG
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
| Retrieval | pgvector + Vertex embeddings |
| AI generation | Gemini 2.5 Flash, optional fine-tuned endpoint |
| Knowledge tracing | BKT, DKT |
| Browser ML | MediaPipe, TensorFlow Lite |
| Deployment | GCP Cloud Run, Artifact Registry, GitHub Actions |
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
gcloud auth application-default login
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
python -m app.rag.ingest
```

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

- [`docs/index.md`](docs/index.md)
- [`docs/architecture/architecture-reference.md`](docs/architecture/architecture-reference.md)
- [`docs/getting-started/adaptive-system-learning-guide.md`](docs/getting-started/adaptive-system-learning-guide.md)
- [`docs/getting-started/agent-learning-guide.md`](docs/getting-started/agent-learning-guide.md)
- [`docs/ml-recommender/recommender-learning-basics.md`](docs/ml-recommender/recommender-learning-basics.md)
- [`docs/finetuning/finetune-results.md`](docs/finetuning/finetune-results.md)
- [`docs/deployment/deployment-plan.md`](docs/deployment/deployment-plan.md)

## Deployment

EduFX is set up for GitHub Actions based deployment to Google Cloud Run with
separate frontend and backend services.

The deployment path includes:

- Docker builds for frontend and backend
- Artifact Registry pushes
- Cloud Run deploys
- build-time backend-origin injection for same-origin frontend proxying
- secret-backed runtime configuration

See:

- [`docs/deployment/deployment-plan.md`](docs/deployment/deployment-plan.md)
- [`.github/workflows/`](.github/workflows)

## Notes

- `DATA_BACKEND=memory` allows the app to run without live Supabase data.
- The recommender and teacher systems are intentionally separate.
- The behaviour layer is optional for students and should never block study use.
- Existing scratch files or private local assets are not part of the tracked app.
