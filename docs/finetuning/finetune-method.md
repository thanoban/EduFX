# Fine-Tune Method

QLoRA on Qwen2.5-7B-Instruct, Colab Enterprise NVIDIA L4, standard Hugging Face stack. See [finetune-results.md](finetune-results.md) for the measured numbers.

## What We're Actually Teaching

The base model already knows chemistry from pretraining. Fine-tuning is not about adding chemistry knowledge — it teaches the EduFX-specific JSON output format and MCQ style. That is why a small task-specific dataset is enough to be useful.

## QLoRA in Plain Terms

Full fine-tuning updates every model weight — expensive in GPU memory, time, and cost. QLoRA combines two ideas to make it practical on a single GPU:

**Quantization** — the base model is loaded in 4-bit form. Memory drops dramatically; the base stays frozen.

**LoRA (Low-Rank Adaptation)** — instead of training the full frozen model, small trainable adapter layers are inserted. Only a tiny fraction of parameters are updated.

Together: frozen 4-bit base + trainable adapters on top.

## Why These Choices Were Made

| Decision | Reason |
|----------|--------|
| Colab Enterprise over free Colab | Free tier gave bf16/fp16 scaler crashes, dtype mismatches, and package conflicts |
| NVIDIA L4 over T4 | More VRAM, cleaner environment, reliable for 7B models in 4-bit |
| Qwen2.5-7B-Instruct | Strong instruction following, fits L4 in 4-bit, compatible with HF stack |
| Standard HF stack (no Unsloth) | More transparent training loop, easier to explain in a viva |

## Notebook Pipeline

1. Verify GPU (`torch.cuda.is_available()`)
2. Install stack (`transformers peft trl bitsandbytes accelerate datasets`)
3. Load tokenizer and 4-bit base model with `BitsAndBytesConfig`
4. Attach LoRA adapters via `get_peft_model()` with `r=8, lora_alpha=16`
5. Format JSONL records with `tokenizer.apply_chat_template()`
6. Run `SFTTrainer` for 3 epochs
7. Save adapter with `model.save_pretrained()`

## Chat Template

Raw JSONL stores clean `instruction` / `output` fields. The notebook wraps each example at training time into Qwen's ChatML format. This keeps the dataset model-agnostic — switching base models only changes the wrapping step, not the stored data.

## Loss Results

| Epoch | Train Loss | Val Loss |
|------:|----------:|---------:|
| 1 | 1.6117 | 1.2146 |
| 2 | 1.2979 | 1.1323 |
| 3 | 1.1886 | 1.0471 |

Decreasing validation loss confirms the adapter was learning. The validation set is 1 record, so these numbers are encouraging, not conclusive.

## What This Run Proves and Doesn't Prove

**Proves:** dataset format is valid, QLoRA setup works, training completes, adapter saves correctly.

**Does not prove:** strong generalisation, production readiness, stable performance across a broad syllabus. Dataset is 5 training + 1 validation record.

## Why Task B Was Not Fine-Tuned

Explanation generation depends on the student's specific wrong answer and live RAG context. A static fine-tune cannot capture that variability. Task B stays on live Vertex AI Gemini + RAG; only Task A (quiz generation) uses the fine-tuned adapter.

## Viva Answers

**"Why not RAG only?"**
RAG supplies facts at runtime but doesn't guarantee the EduFX JSON structure. Fine-tuning teaches format; RAG supplies content. They solve different problems.

**"Why not Vertex managed tuning?"**
Managed tuning hides the training mechanics. Self-run QLoRA gave direct control over quantisation, adapters, chat templating, and loss curves — better learning value and a clearer viva story.

**"Why did you change approach mid-way?"**
The original free-Colab/Unsloth route had repeated mixed-precision and library-compatibility failures. Moving to Colab Enterprise L4 with the standard HF stack was a deliberate engineering decision to improve reliability while keeping the training self-run.
