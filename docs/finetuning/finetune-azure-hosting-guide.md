# Hosting the Fine-Tuned Model on Azure (On/Off GPU VM)

This is the step-by-step guide for getting `edufx-qwen25-7b-lora` (trained per
[finetune-colab-guide.md](finetune-colab-guide.md)) running as a live GPU API on
Azure, using an **on/off VM**: start it when you actually want to test or demo
the fine-tuned model, deallocate it the rest of the time so it costs nothing
while idle.

## Read this first — the honest tradeoff

A GPU VM bills **by the hour while running**, whether or not it's actually
generating a quiz — this is a real box, not a serverless endpoint. That's why
the on/off pattern matters: **deallocate the VM whenever you're not using it**.
Set a **budget alert** the day you launch the instance (step 2) so unexpected
usage doesn't quietly burn through your Azure credit.

Other options considered and why this one won:
- **Hugging Face ZeroGPU** — hosting your own Space needs paid PRO ($9/mo);
  the free tier only lets you *use* someone else's Space.
- **Modal.com** — a genuinely recurring $30/month free credit, no card
  required, would be the lower-maintenance choice if you didn't already have
  Azure credit sitting unused.
- **AWS EC2** — same shape as this guide (see
  [finetune-aws-hosting-guide.md](finetune-aws-hosting-guide.md)), but the
  user has Azure credit, not AWS, so Azure was chosen instead.

---

## 1. Launch the VM

1. Azure Portal → **Virtual Machines** → **Create**.
2. Image: **Ubuntu 22.04 LTS**.
3. Size: **`Standard_NC4as_T4_v3`** (1× T4 GPU, 16GB VRAM — same GPU class as
   AWS's `g4dn.xlarge`, fits Qwen2.5-7B in 4-bit with the adapter attached).
4. Authentication: SSH public key — download the private key.
5. Disk: bump the OS disk if the default is small; the base model download
   alone is several GB.
6. **Networking → Inbound port rules**: allow **SSH (22)** and add a custom
   rule for **TCP port 8080** (source: your IP, or the Cloud Run backend's
   egress range if you want to lock it down later — there's no auth on the
   vLLM endpoint itself).
7. Create, wait for it to reach "Running", note the **public IP address**.

## 2. Set a budget alert (do this now, not later)

Azure Portal → **Cost Management + Billing** → **Budgets** → create a budget
alert well below your credit balance so you get a warning before the credit
runs out unexpectedly.

## 3. SSH in and serve the model

```bash
ssh -i your-key.pem azureuser@<vm-public-ip>

pip install vllm

# Upload your adapter folder from your local machine first:
#   scp -i your-key.pem -r edufx-qwen25-7b-lora azureuser@<vm-public-ip>:~/

python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --enable-lora \
  --lora-modules edufx=./edufx-qwen25-7b-lora/ \
  --port 8080 \
  --host 0.0.0.0
```

This is the exact command already documented in
[finetune-colab-guide.md §17](finetune-colab-guide.md) and
[finetune-aws-hosting-guide.md](finetune-aws-hosting-guide.md) — no merge step
needed, vLLM serves the base model + LoRA adapter together and exposes a
standard OpenAI-compatible `/v1/chat/completions` endpoint at port 8080.

The first run downloads the ~14GB base model — expect 5-10 minutes before the
server is ready. Wait for `Uvicorn running on http://0.0.0.0:8080` in the logs.

## 4. Auto-start on boot (systemd service)

So that starting the VM is the *only* manual step — no need to SSH in and
re-run the vLLM command every time — set it up as a systemd service:

```bash
sudo tee /etc/systemd/system/edufx-vllm.service > /dev/null <<EOF
[Unit]
Description=EduFX vLLM Fine-tuned Model Server
After=network.target

[Service]
User=azureuser
WorkingDirectory=/home/azureuser
ExecStart=/usr/local/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --enable-lora \
  --lora-modules edufx=/home/azureuser/edufx-qwen25-7b-lora/ \
  --port 8080 \
  --host 0.0.0.0
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable edufx-vllm
sudo systemctl start edufx-vllm
```

Check it came up:

```bash
sudo journalctl -u edufx-vllm -f
```

From now on, starting the VM automatically starts the model server — no SSH
required for routine use.

## 5. Wire it into the backend

This reuses settings that **already exist** in the app — no new code, no new
config keys:

```
FINETUNED_MODEL_URL=http://<vm-public-ip>:8080
FINETUNED_MODEL_NAME=edufx
```

Set these in `.env` locally and as GitHub Actions secrets for production
(`server/app/core/config.py`'s `Settings` already reads both, and
[ai_service.py](../server/app/services/ai_service.py)'s `_call_finetuned` is
already the first candidate tried in the quiz-generation fallback chain).

## 6. Stop / start the VM

```bash
# Stop billing (from your local machine, with the Azure CLI configured):
az vm deallocate --resource-group <your-rg> --name <your-vm-name>

# Resume later:
az vm start --resource-group <your-rg> --name <your-vm-name>
```

Deallocating stops compute billing (disk storage still bills, but that's
minor). Because the systemd service is enabled, starting the VM again brings
the model server back up on its own.

**Note:** the public IP changes on every deallocate/start unless you attach a
**Static Public IP** (which has its own small idle cost — factor that into
your budget alert if you go that route). Update `FINETUNED_MODEL_URL` if the
IP changes.

## 7. Verify it's actually being used

Once `FINETUNED_MODEL_URL` is set and the VM is running, the very next quiz
generation should hit this endpoint first. Check the vLLM server's logs
(`sudo journalctl -u edufx-vllm -f`) — a real request will show up there. If
it doesn't, the app silently fell through to Gemini/Groq instead (by design —
never a hard dependency), which usually means the NSG rule, IP, or port is
misconfigured.
