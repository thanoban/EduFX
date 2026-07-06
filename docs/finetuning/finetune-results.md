# Fine-Tune Results

Successful run completed on Colab Enterprise — Qwen2.5-7B-Instruct with QLoRA, NVIDIA L4, 263 seconds.

## Environment

| Item | Value |
|------|-------|
| Platform | Google Cloud Colab Enterprise |
| Region | `us-central1` |
| Machine | `g2-standard-4`, NVIDIA L4 × 1 |
| Python | 3.12 |
| Base model | `Qwen/Qwen2.5-7B-Instruct` |
| Method | QLoRA (4-bit base + LoRA adapters) |
| Stack | transformers · peft · trl · bitsandbytes · accelerate · datasets |

## Dataset

| File | Records |
|------|---------|
| `data/finetune/train.jsonl` | 5 |
| `data/finetune/val.jsonl` | 1 |

Each record produces exactly 15 questions: 5 easy, 5 medium, 5 hard. Topic scope: `mixed_inorganic`.

This size is sufficient to prove the pipeline works but not to claim production-quality generalisation.

## Training Configuration

| Parameter | Value |
|-----------|-------|
| Epochs | 3 |
| Batch size (train / eval) | 1 / 1 |
| Gradient accumulation steps | 4 |
| Learning rate | 2e-4 |
| Warmup steps | 5 |
| Max length | 3072 |
| Optimizer | `paged_adamw_8bit` |
| fp16 / bf16 | both off (stability) |
| Gradient checkpointing | on |
| Seed | 42 |

## Measured Results

Total runtime: **263 seconds** · Final training loss: **1.3884**

| Epoch | Train Loss | Val Loss | Token Accuracy |
|------:|----------:|---------:|---------------:|
| 1 | 1.6117 | 1.2146 | 74.3 % |
| 2 | 1.2979 | 1.1323 | 75.2 % |
| 3 | 1.1886 | 1.0471 | 76.0 % |

Validation loss decreased each epoch — the adapter was learning the target format. Because the validation set is only 1 record, these numbers support "pipeline works" but not a strong quality claim.

## Adapter Output

Files produced by `model.save_pretrained()` + `tokenizer.save_pretrained()`:

| File | Purpose |
|------|---------|
| `adapter_model.safetensors` | Trained LoRA delta weights (~50 MB) |
| `adapter_config.json` | r=8, alpha=16, 7 target projection layers |
| `tokenizer_config.json` | Qwen2Tokenizer, 128k context, ChatML tokens |
| `chat_template.jinja` | ChatML format required at inference |
| `tokenizer.json` | Full vocabulary |

## Integration

Task A (quiz generation) routes to the fine-tuned Qwen via vLLM. Task B (explanations) stays on live Vertex AI Gemini. See [finetune-colab-guide.md](finetune-colab-guide.md) §17 for the `_call_finetuned()` integration code.

## Viva Statement

> "The fine-tune completed successfully on Colab Enterprise with an NVIDIA L4. Training and validation loss both improved across three epochs, and the adapter was saved. With only 5 training records I treat this as a pipeline proof, not a production-quality model — the clear next step is expanding to 50–100 reviewed examples."
