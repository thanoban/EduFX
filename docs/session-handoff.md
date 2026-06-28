# EduFX — Session Handoff

> Read this at the start of every new session to get full context.
> Last updated: 2026-06-28

## What This Project Is

**EduFX** — A-Level Chemistry adaptive study platform, S-block unit (10 subtopics).

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v3 |
| Backend | FastAPI (Python), layered MVC |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Google OAuth |
| AI / LLM | **Vertex AI — Gemini 2.5 Flash** (not Groq, not Gemini REST, not OpenAI) |
| Embeddings | `gemini-embedding-001` via Vertex AI (384-dim) |
| Vector store | Supabase `content_chunks` with pgvector |

**Repo:** `https://github.com/thanoban/EduFX.git`
**Project root:** `D:\PROJECTS\2ndYearProject\EduFX_MVC`

## Critical Rules

1. **Commit as `thanoban` only** — never add `Co-Authored-By: Claude` to any commit message.
2. **AI = Vertex AI only** — `GOOGLE_CLOUD_PROJECT` env var, `google-cloud-aiplatform` SDK. No Groq, no Gemini REST, no OpenAI.
3. **`.env` is gitignored** — never commit it.

## Architecture

```
Controller (routes/) → Service (services/) → Repository (repositories/) → Model (models/)
```

Repository layer has two implementations switchable via `DATA_BACKEND` env var:
- `memory` — in-memory `DemoDataStore`, no external dependencies
- `supabase` — real Supabase queries

## Environment Variables

```
DATA_BACKEND=supabase
DEMO_MODE=false
FRONTEND_ORIGIN=http://localhost:3000
SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
GOOGLE_CLOUD_PROJECT=responsive-sun-491204-e0
GOOGLE_CLOUD_LOCATION=global
VERTEX_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=384
```

For local Vertex AI: run `gcloud auth application-default login` once.

## What Is Built and Working

### Backend
All 9 controllers, services, and repositories are complete (auth, diagnostic, scheduler, content, quiz, results, explanation, progress, behaviour). Vertex AI quiz generation and RAG-augmented explanation generation both work. 16 unit tests passing.

### Frontend
All 12 routes complete with professional UI (Inter font, indigo design system): login, dashboard, diagnostic, diagnostic/results, study/[id], quiz/[id], results/[id], progress, behaviour-logs, settings, webcam-check. Zero TypeScript build errors.

### RAG Pipeline ✅ (completed 2026-06-28)
`data/notes/s_block_notes.csv` — all 10 subtopics written and ingested. 55 chunks embedded and stored in Supabase `content_chunks`. `match_content_chunks` RPC verified working.

### Fine-Tuning ✅
Qwen2.5-7B-Instruct + QLoRA on Colab Enterprise NVIDIA L4. Adapter saved. See [finetune-results.md](finetune-results.md) for metrics and [finetune-colab-guide.md](finetune-colab-guide.md) for the full notebook.

### Personalized Quiz Generation ✅
Concept-mastery loop: `questions.concept` column, `select_weak_concepts()`, `level_difficulty_spread()`, weak-aware AI prompt targeting ~65% of questions at weak concepts.

### Deployment Config ✅ (added 2026-06-28)
`server/Dockerfile`, `client/Dockerfile`, `.github/workflows/deploy.yml` — Cloud Run deployment via GitHub Actions. See [deployment.md](deployment.md).

## Subtopic IDs

| ID | Group | Title |
|----|-------|-------|
| 1 | group1 | Group Trends |
| 2 | group1 | Reactions of Group 1 Elements |
| 3 | group1 | Thermal Stability of Salts |
| 4 | group1 | Solubility of Group 1 Salts |
| 5 | group1 | Flame Test |
| 6 | group2 | Group Trends |
| 7 | group2 | Reactions of Group 2 Elements |
| 8 | group2 | Thermal Stability of Salts |
| 9 | group2 | Solubility of Group 2 Salts |
| 10 | group2 | Flame Test |

## Key Files to Read First

| File | Purpose |
|------|---------|
| `server/app/core/container.py` | How all services and repos are wired |
| `server/app/core/store.py` | Demo data structure |
| `server/app/services/ai_service.py` | Vertex AI integration |
| `shared/contracts/index.ts` | All TypeScript types |
| `docs/data-format-guide.md` | RAG CSV + fine-tuning JSONL formats |
