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
