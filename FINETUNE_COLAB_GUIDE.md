# Fine-Tuning Guide — Google Colab + Vertex AI

This guide explains **how to fine-tune an open model in Google Colab** (for the learning
experience) while **using Vertex AI for the production API**. No code — just the decisions,
steps, and reasoning.

---

## 1. The key decision you must understand first

There are **two separate things** you might mean by "fine-tuning," and they do **not** mix:

| Path | What it is | Where it runs | Do you see the learning? |
|---|---|---|---|
| **A — Vertex AI managed tuning** | Upload JSONL → Google tunes Gemini for you | Google Cloud (black box) | ❌ No. You don't see the training loop, loss, or epochs. |
| **B — Colab self fine-tuning** | You train an *open* model (Gemma/Llama) yourself with QLoRA | Free Colab GPU | ✅ Yes. You see loss curves, epochs, everything. |

**The trap:** A model you fine-tune in **Path B (Colab)** is an *open-weight* model
(Gemma, Llama…). It is **NOT a Gemini model**, so it **cannot be served through the
Vertex AI Gemini API**. The Gemini API only serves Google's own Gemini models.

### So what should you actually do?

Recommended hybrid for this project:

- **Production API → keep Vertex AI Gemini 2.5 Flash** (already built into the app, no
  fine-tuning needed — prompt + RAG handles quiz + explanations well).
- **Learning exercise → fine-tune Gemma 2 in Colab** on your chemistry data. This is
  where you actually *learn* fine-tuning.
- **Optional later:** if you want your fine-tuned Gemma in production, you deploy it to a
  **Vertex AI custom endpoint** (Model Garden) — a separate serving path from the Gemini
  API, and it **costs money to keep running** (not free).

> **Bottom line:** Use Colab fine-tuning to learn. Keep Gemini-via-Vertex-AI for the live
> app. Don't expect the Colab-trained model to appear in the Gemini API — it won't.

---

## 2. Which free models can you train?

All of these are **open weights and free to fine-tune**. Free Colab gives you a **T4 GPU
(16 GB)**, which is enough for small models using **QLoRA (4-bit quantization)**.

| Model | Size | Fits free Colab (QLoRA)? | Notes |
|---|---|---|---|
| **Gemma 2 2B** | 2B | ✅ Easily | **Best pick** — Google ecosystem, small, fast |
| Gemma 2 9B | 9B | ⚠️ Tight but possible | Better quality, slower, may need Colab Pro |
| Llama 3.2 1B / 3B | 1–3B | ✅ Easily | Great small alternative |
| Phi-3 mini | 3.8B | ✅ Yes | Strong reasoning for its size |
| Mistral 7B | 7B | ⚠️ Tight | Needs careful QLoRA settings |

**Recommendation: Gemma 2 2B.** It's small enough to train comfortably on free Colab,
it's from Google (consistent with your stack), and 2B is plenty for a narrow task like
"explain why this chemistry answer is wrong."

### Access requirement
- **Gemma / Llama** require accepting a license on **Hugging Face** before download. You
  create a free HF account, accept the model terms, and generate an access token.

---

## 3. How much data do you need (recap)

- **Task A (quiz generation):** 100–200 examples is enough. Optional to fine-tune at all.
- **Task B (explanations):** 50–300 examples. **Recommended to skip fine-tuning** — prompt
  + RAG handles per-answer explanations better (see `DATA_FORMAT_GUIDE.md`).
- **No need** to split data by subtopic or by beginner/intermediate/advanced. One flat
  JSONL file; put the level as a label *inside* the prompt text.
- **Quality > quantity.** 80 clean examples beat 500 messy ones.

If you only fine-tune **one** task as a learning exercise, do **Task A (quiz generation)** —
its value is consistent structure (15 questions, valid JSON, exam style), which is exactly
what fine-tuning is good at.

---

## 4. Step-by-step — fine-tuning in Google Colab (no code)

### Phase 1 — Prepare the data
1. Collect your training examples into a single **JSONL** file (one example per line).
2. Each line = an instruction/response pair (the prompt + the ideal answer).
3. Use the export script already in the repo (`server/notebooks/export_training_data.py`)
   to pull Task B examples from Supabase, or hand-write Task A examples.
4. Split into **train (~90%)** and **validation (~10%)** so you can watch for overfitting.
5. Upload the JSONL to Colab (drag into the file panel, or mount Google Drive).

### Phase 2 — Set up the Colab environment
6. Open a new Colab notebook. Set **Runtime → Change runtime type → T4 GPU**.
7. Install the training libraries (Unsloth or Hugging Face `transformers` + `peft` + `trl`
   + `bitsandbytes`). **Unsloth is recommended** — it's free, ~2× faster, and fits bigger
   models on the free T4.
8. Add your **Hugging Face token** as a Colab secret (to download Gemma/Llama).

### Phase 3 — Load the base model
9. Download the base model in **4-bit (QLoRA)** form — this is what makes it fit in 16 GB.
10. Attach **LoRA adapters** (you train these small adapter layers, not the whole model —
    that's why it fits on free hardware).

### Phase 4 — Train
11. Point the trainer at your JSONL, set the chat/prompt format to match how you'll call
    the model later.
12. Set key hyperparameters: **epochs (2–3 is plenty)**, learning rate, batch size,
    max sequence length.
13. Start training. **Watch the loss curve** — this is the "learning" you wanted to see.
    Training loss should drop; if validation loss starts rising, you're overfitting → stop.
14. A small dataset on Gemma 2 2B typically trains in **minutes to ~1 hour** on free Colab.

### Phase 5 — Test
15. Run a few sample prompts through the freshly tuned model **inside the notebook**.
16. Compare against the base model on the same prompts — confirm the tuned one follows your
    format/style better.

### Phase 6 — Save the result
17. **Merge** the LoRA adapters into the base model (gives you a standalone model), OR keep
    the adapters separate (smaller, reusable).
18. **Push to Hugging Face Hub** (free) so the model is stored and shareable, OR download the
    files to Google Drive.
19. Optionally export to **GGUF** format if you want to run it locally with Ollama / llama.cpp.

---

## 5. How to actually USE the fine-tuned model

Pick based on budget and goal:

| Goal | How to serve | Cost |
|---|---|---|
| **Just learning / demo in notebook** | Run it in Colab directly | Free |
| **Run on your own machine** | Export to GGUF → **Ollama** or llama.cpp | Free |
| **Free hosted API** | Push to **Hugging Face Hub** → HF Inference | Free tier (rate-limited) |
| **Production endpoint** | Deploy to **Vertex AI Model Garden** custom endpoint | 💰 Paid (always-on GPU) |

> Your live EduFX app keeps calling **Vertex AI Gemini 2.5 Flash** as it does now. The
> Colab-trained Gemma is a separate artifact — swap it in only if/when you deploy it to one
> of the serving paths above.

---

## 6. Summary cheat-sheet

- ✅ Fine-tune **Gemma 2 2B** in **Colab (free T4)** using **QLoRA + Unsloth** → this is your
  learning path.
- ✅ Keep **Vertex AI Gemini 2.5 Flash** for the live API.
- ❌ A Colab-tuned Gemma **cannot** be served via the Vertex AI *Gemini* API — different
  model family.
- ✅ Data: one flat JSONL, **no subtopic split, no difficulty split**, level goes in the
  prompt text. 100–200 examples is enough.
- ✅ If tuning only one task, do **Task A (quiz generation)**; let **Task B (explanations)**
  stay on prompt + RAG.
- 💰 Serving the tuned model in production (Vertex endpoint) is the only paid step — Colab
  training, HF hosting, and local Ollama are free.
