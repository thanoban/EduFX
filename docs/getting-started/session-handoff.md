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
