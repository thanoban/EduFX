# EduFX Deployment Plan

Complete plan to deploy EduFX to Google Cloud Platform via GitHub Actions, plus serving the fine-tuned Qwen model.

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
| `SUPABASE_KEY` | anon public key | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | Supabase → Project Settings → API |
| `SUPABASE_JWT_SECRET` | JWT secret | Supabase → Project Settings → API → JWT Settings |
| `FRONTEND_URL` | (blank initially, fill after first deploy) | Cloud Run frontend URL |

These map directly into the Cloud Run service env vars in `.github/workflows/deploy.yml`. Nothing secret lives in the repo — `.env` stays gitignored.

---

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
NEXT_PUBLIC_SUPABASE_ANON_KEY = Supabase anon key
```

The workflow passes the backend's deployed URL into the frontend build automatically (`needs.deploy-backend.outputs.url`), so the order is: **backend deploys first → its URL feeds the frontend build → frontend deploys**.

---

## Part 5 — First Deploy Sequence

1. Complete Part 1 (GCP setup) and Part 2 (all secrets except `FRONTEND_URL`).
2. Push to `main` — GitHub Actions runs `deploy.yml` automatically.
3. Backend builds and deploys → frontend builds (using backend URL) and deploys.
4. Copy the **frontend URL** from the Actions log.
5. Add it as the `FRONTEND_URL` secret.
6. Re-run the workflow (or push again) so the backend picks up `FRONTEND_ORIGIN` and locks CORS to the real frontend.
7. Visit the frontend URL — the app is live.

The workflow is already committed at `.github/workflows/deploy.yml`. Trigger is `push` to `main` or manual `workflow_dispatch`.

---

## Part 6 — Fine-Tuned Model Deployment (Optional)

The fine-tuned Qwen2.5-7B adapter ([finetune-results.md](finetune-results.md)) serves Task A (quiz generation). The app calls it via a vLLM OpenAI-compatible endpoint and **falls back to Gemini if `FINETUNED_MODEL_URL` is unset** — so this is optional and can be added later.

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

This exposes `/v1/chat/completions`. Point the backend at it by setting `FINETUNED_MODEL_URL=http://<vm-ip>:8080` in the Cloud Run env. The integration code (`_call_finetuned()` in `ai_service.py`) is documented in [finetune-colab-guide.md](finetune-colab-guide.md) §17.

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
- [ ] Supabase schema applied (tables + `content_chunks` + `match_content_chunks` RPC)
- [ ] RAG notes ingested (55 chunks in `content_chunks`)
- [ ] First push to `main` succeeds in Actions
- [ ] `FRONTEND_URL` secret added after first deploy, workflow re-run
- [ ] `edufx-deploy-key.json` deleted from local machine
- [ ] (Optional) GPU VM + vLLM for the fine-tuned model
