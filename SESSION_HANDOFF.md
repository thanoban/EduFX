# EduFX — Session Handoff / Current State

> Read this at the start of every new session to get full context instantly.
> Last updated: 2026-06-25

---

## What this project is

**EduFX** — A-Level Chemistry adaptive study platform (S-block unit only).

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v3 |
| Backend | FastAPI (Python), layered MVC architecture |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Google OAuth |
| AI / LLM | **Vertex AI — Gemini 2.5 Flash** (NOT Groq, NOT Gemini REST, NOT OpenAI) |
| Embeddings | Vertex AI text-embedding-004 (384-dim) |
| Vector store | Supabase `content_chunks` table with pgvector |

**Repo:** `https://github.com/thanoban/EduFX.git`
**Project folder:** `D:\PROJECTS\2ndYearProject\EduFX_MVC`
**Source reference (old monolith):** `D:\PROJECTS\2ndYearProject\Edu_FX`

---

## CRITICAL rules for this project

1. **Commit as `thanoban` only.** NEVER add `Co-Authored-By: Claude` to any commit message.
2. **Primary working directory = `D:\PROJECTS\2ndYearProject\EduFX_MVC`**. Always run
   Claude Code sessions from this folder — not from OceanEye or any other project.
3. **AI = Vertex AI only.** No Groq, no Gemini REST API, no OpenAI. The env var is
   `GOOGLE_CLOUD_PROJECT`, served via `google-cloud-aiplatform` SDK.
4. **`.env` is gitignored.** Never commit it. It contains real Supabase and GCP credentials.

---

## Architecture — MVC layers

```
Controller (routes/) → Service (services/) → Repository (repositories/) → Model (models/)
```

- **Controller:** HTTP only, no logic. Located in `server/app/routes/` + `controllers/`
- **Service:** Business logic, AI calls, orchestration. Located in `server/app/services/`
- **Repository:** All DB access. Two implementations per domain:
  - `repositories/*.py` → in-memory `DemoDataStore` (demo/test mode)
  - `repositories/supabase_*.py` → real Supabase queries
- **Model:** Pure Pydantic — `models/domain.py` (domain objects) + `models/dto.py` (API shapes)

Switch between backends via `DATA_BACKEND=memory` or `DATA_BACKEND=supabase` in `.env`.

---

## Current .env (DO NOT COMMIT — just remember these vars are needed)

```
APP_NAME=EduFX MVC API
FRONTEND_ORIGIN=http://localhost:3000
SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
GOOGLE_CLOUD_PROJECT=responsive-sun-491204-e0
GOOGLE_CLOUD_LOCATION=global
VERTEX_MODEL=gemini-2.5-flash
DATA_BACKEND=supabase
DEMO_MODE=false
```

For Vertex AI to work locally: run `gcloud auth application-default login` once.

---

## What is fully built and working

### Backend (`server/`)
| File/area | Status |
|---|---|
| `app/core/config.py` | ✅ Vertex AI vars, Supabase vars, no Groq/Gemini REST |
| `app/core/clients.py` | ✅ Calls `vertexai.init()` at startup |
| `app/core/container.py` | ✅ Wires all services + repositories + RAG |
| `app/core/store.py` | ✅ In-memory DemoDataStore (10 subtopics, seeded questions/content) |
| `app/core/rules.py` | ✅ Level logic, scheduler priority, focus score, behaviour aggregation |
| `app/models/domain.py` | ✅ All domain objects |
| `app/models/dto.py` | ✅ All DTOs |
| All 9 controllers | ✅ auth, diagnostic, scheduler, content, quiz, results, explanation, progress, behaviour |
| All 9 routes | ✅ Same domains |
| All services | ✅ auth, diagnostic, scheduler, content, quiz, results, explanation, progress, behaviour |
| `services/ai_service.py` | ✅ Vertex AI quiz generation + explanation (Gemini 2.5 Flash) |
| `services/quiz_service.py` | ✅ First-attempt vs personalized, AI generation with demo fallback |
| `services/explanation_service.py` | ✅ RAG + Vertex AI explanation per wrong answer |
| All demo repositories | ✅ Memory-backed for all domains |
| All Supabase repositories | ✅ Real DB queries for all domains |
| `app/rag/embedder.py` | ✅ text-embedding-004, 384-dim |
| `app/rag/retriever.py` | ✅ Calls `match_content_chunks` Supabase RPC |
| `app/rag/ingest.py` | ✅ CSV → chunk → embed → store. Run: `python -m app.rag.ingest` |
| `repositories/rag_repository.py` | ✅ Wraps retriever, returns [] gracefully when no Supabase |
| `requirements.txt` | ✅ `google-cloud-aiplatform>=1.60.0`, no groq |

### Backend Tests (`server/tests/`)
| File | Tests | Status |
|---|---|---|
| `unit/test_rules.py` | 4 | ✅ Passing |
| `unit/test_repository_factory.py` | 2 | ✅ Passing |
| `unit/test_behaviour_service.py` | 6 | ✅ Passing |
| `unit/test_results_service.py` | 4 | ✅ Passing |
| **Total** | **16** | ✅ All green |

Run tests: `cd server && python -m pytest tests/unit/ -v`

### Frontend (`client/`)
| Area | Status |
|---|---|
| Next.js 15 App Router setup | ✅ |
| Tailwind CSS v3 (alongside existing CSS — no base/preflight) | ✅ |
| `shared/contracts/index.ts` | ✅ All TypeScript types |
| `lib/api.ts` | ✅ All API calls (auth, diagnostic, quiz, results, explanation, progress, behaviour, scheduler) |
| `lib/constants.ts` + `lib/storage.ts` | ✅ |
| `features/auth/auth-provider.tsx` | ✅ Supabase OAuth context |
| `features/auth/login-screen.tsx` | ✅ Google sign-in |
| `features/diagnostic/diagnostic-screen.tsx` | ✅ 40-question diagnostic |
| `features/diagnostic/diagnostic-results-screen.tsx` | ✅ Level assignments per subtopic |
| `features/dashboard/dashboard-screen.tsx` | ✅ Study plan, scheduler |
| `features/study/study-screen.tsx` | ✅ Content reader |
| `features/quiz/quiz-screen.tsx` | ✅ Navigator, webcam toggle, submit |
| `features/results/results-screen.tsx` | ✅ Score, focus, per-question review with AI explanations |
| `features/progress/progress-screen.tsx` | ✅ History per subtopic |
| `features/behaviour/behaviour-logs-screen.tsx` | ✅ Session behaviour history |
| `features/settings/settings-screen.tsx` | ✅ Profile settings |
| `features/webcam/webcam-check-screen.tsx` | ✅ Camera preview + tracking toggle |
| All app pages (routes) | ✅ login, dashboard, diagnostic, diagnostic/results, study/[id], quiz/[id], results/[id], progress, behaviour-logs, settings, webcam-check |
| TypeScript build | ✅ Zero errors (`npm run build`) |

### Data & Infra
| File | Status |
|---|---|
| `infra/sql/bootstrap.sql` | ✅ All tables + pgvector extension + `match_content_chunks` RPC |
| `infra/.env.server.example` | ✅ Template with Vertex AI vars |
| `data/notes/.gitkeep` | ✅ Folder exists, ready for CSV files |
| `data/notes/s_block_notes.csv` | ✅ 3 sample subtopic bodies to show the format |
| `data/finetune/.gitkeep` | ✅ Folder exists for JSONL training data |
| `server/notebooks/export_training_data.py` | ✅ CLI script to export Task B JSONL from Supabase |

---

## What still needs to be done (by the user, not code)

### 1. RAG content — YOU need to write the notes
The `data/notes/s_block_notes.csv` has 3 example rows. You need to fill in **all 10 subtopics**.
Format: `subtopic_id,body` — one row per subtopic, plain prose notes, no level split needed.
Once the CSV is ready: `cd server && python -m app.rag.ingest` — this chunks, embeds, and stores.

Subtopic IDs (from DemoDataStore seed):
- 1 = Group Trends (Group 1)
- 2 = Reactions of Group 1 Elements
- 3 = Thermal Stability of Salts (Group 1)
- 4 = Solubility of Group 1 Salts
- 5 = Flame Test (Group 1)
- 6 = Group Trends (Group 2)
- 7 = Reactions of Group 2 Elements
- 8 = Thermal Stability of Salts (Group 2)
- 9 = Solubility of Group 2 Salts
- 10 = Flame Test (Group 2)

### 2. Supabase DB setup
Run `infra/sql/bootstrap.sql` in the Supabase SQL editor once if you haven't already.
This creates the `content_chunks` table and the `match_content_chunks` function.

### 3. Vertex AI authentication (local dev)
Run once: `gcloud auth application-default login`
This lets the server use your GCP credentials without a service account key.

### 4. Manual questions in Supabase
The demo store has auto-generated questions. For the real Supabase `questions` table,
you need real A-level S-block MCQs seeded (stage = "first", 15 per subtopic).

---

## Fine-tuning decisions (settled)

- **Fine-tune: optional, Task A (quiz generation) only** if the prompt output is inconsistent.
- **Task B (explanations): do NOT fine-tune.** Prompt + RAG already handles per-answer explanations.
- **Model for fine-tuning: Gemma 2 2B** in Google Colab (free T4 GPU, QLoRA).
- **Serving fine-tuned model: NOT via Vertex AI Gemini API** (different model family).
  Options: Hugging Face Hub (free, rate-limited) or Vertex AI custom endpoint (paid).
- **Production API stays: Vertex AI Gemini 2.5 Flash** — already built into the app.
- Full guide: see `FINETUNE_COLAB_GUIDE.md`

---

## Key files to read first in a new session

1. This file (`SESSION_HANDOFF.md`) — overall state
2. `server/app/core/container.py` — how everything is wired
3. `server/app/core/store.py` — demo data structure
4. `shared/contracts/index.ts` — all TypeScript types
5. `server/app/services/ai_service.py` — Vertex AI integration
6. `DATA_FORMAT_GUIDE.md` — RAG CSV + fine-tuning JSONL formats
7. `FINETUNE_COLAB_GUIDE.md` — Colab training steps

---

## Git commit log

```
593f695 Add Colab fine-tuning guide with model options, steps, and serving paths
c92f5ee Add unit tests for behaviour+results services, JSONL export script, sample notes CSV
8058d90 Switch to Vertex AI (gemini-2.5-flash) — remove Gemini REST API key dependency
73007db Add RAG pipeline, Gemini AI quiz generation, Tailwind CSS, data scaffold
52fd4c8 Build EduFX MVC frontend and Supabase integration
c175733 Initial EduFX MVC rebuild
```

All commits authored as `thanoban`. No Co-Authored-By lines.
