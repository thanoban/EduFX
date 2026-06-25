# EduFX MVC

EduFX MVC is a clean-room rebuild of the Adaptive Education Platform as a CV-friendly hybrid MVC and layered full-stack project.

## Structure

- `server/` FastAPI backend with `models`, `repositories`, `services`, `controllers`, `routes`, and presenters
- `client/` Next.js frontend with feature modules and shared UI
- `shared/` common DTO and response contracts
- `infra/` local environment examples, SQL bootstrap, and run helpers

## Highlights

- Preserves the original endpoint contract from the project brief
- Keeps Google auth support in the frontend flow
- Uses a seeded in-memory fallback so the demo runs locally without blocking on Supabase data
- Uses Supabase for live persistence and Vertex AI for quiz/explanation generation
- Defines explicit repository and service contracts for MVC-friendly dependency boundaries
- Supports `memory` and `supabase` backends through the same repository contracts

## Architecture notes

- `server/app/repositories/contracts.py` defines repository-facing interfaces.
- `server/app/core/repository_factory.py` selects the active backend implementation.
- `server/app/services/contracts.py` defines business-service interfaces.
- `server/app/controllers` stays thin and only orchestrates service calls plus response presenters.
- `shared/contracts/index.ts` holds DTO shapes consumed by the client and aligned to the API envelope.

## Run locally

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

The development frontend bypasses the visible login screen by default and opens the post-login EduFX workspace with the demo student. Set `NEXT_PUBLIC_SKIP_LOGIN=false` when the Google login phase is ready to test again.

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

## Environment

- Backend example: [infra/.env.server.example](D:/PROJECTS/2ndYearProject/EduFX_MVC/infra/.env.server.example)
- Frontend example: [infra/.env.client.example](D:/PROJECTS/2ndYearProject/EduFX_MVC/infra/.env.client.example)

### Supabase mode

Set the backend env like this when you want live persistence instead of the seeded in-memory demo store:

```powershell
DATA_BACKEND=supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
GOOGLE_CLOUD_PROJECT=...
GOOGLE_CLOUD_LOCATION=global
VERTEX_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=384
```

If `DATA_BACKEND=supabase` is set without valid credentials, the app safely falls back to the in-memory backend.

### Seed Supabase

Run the SQL bootstrap first from the Supabase SQL editor, then seed the baseline curriculum rows:

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
python -m app.tools.seed_supabase --dry-run
python -m app.tools.seed_supabase
```

The seed command is idempotent. It adds missing subtopics, level-aware content, diagnostic questions, and first-attempt quiz questions without deleting existing rows.

### Ingest RAG Notes

After filling `data/notes/s_block_notes.csv`, authenticate Vertex AI once and ingest the notes:

```powershell
gcloud auth application-default login
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
python -m app.rag.ingest
```

The ingest command chunks the CSV notes, embeds them with Vertex AI `gemini-embedding-001`, and stores the vectors in Supabase `content_chunks`.

## Notes

- Existing project at `D:\PROJECTS\2ndYearProject\Edu_FX` is intentionally untouched.
- The login screen and Google auth client remain in the codebase, but `/` and `/login` currently route into `/dashboard` for post-login development.
- Behaviour tracking is wired as a client-side demo tracker with API persistence hooks so it can be swapped for MediaPipe and YOLO implementations later.
