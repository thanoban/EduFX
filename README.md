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
- Keeps Supabase and Groq integration seams in place for live credentials
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
SUPABASE_KEY=...
SUPABASE_JWT_SECRET=...
```

If `DATA_BACKEND=supabase` is set without valid credentials, the app safely falls back to the in-memory backend.

## Notes

- Existing project at `D:\PROJECTS\2ndYearProject\Edu_FX` is intentionally untouched.
- Behaviour tracking is wired as a client-side demo tracker with API persistence hooks so it can be swapped for MediaPipe and YOLO implementations later.
