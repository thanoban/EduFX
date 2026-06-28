# EduFX Fine-Tune Guide - Colab Enterprise L4 (Viva Ready)

This is the EduFX fine-tuning path that actually worked end to end.

Final working setup:

- Platform: Google Cloud Colab Enterprise
- Runtime template: `g2-standard-4` with `NVIDIA L4 x1`
- Region used: `us-central1`
- Base model: `Qwen/Qwen2.5-7B-Instruct`
- Method: self-run QLoRA
- Training stack: `transformers + peft + trl + bitsandbytes + accelerate + datasets`
- Dataset used for the successful run:
  - `data/finetune/train.jsonl` = 5 records
  - `data/finetune/val.jsonl` = 1 record

This guide is the one to use for your viva because it reflects the final stable path, not the earlier failed experiments.

---

## 0. Result reference

The measured results of the successful run are now kept separately in:

- [RESULT_FINETUNE.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/RESULT_FINETUNE.md)

Use this guide for the process and setup. Use the results file for the final numbers and viva evidence.

---

## 1. What happened technically

We tried the free Colab / Unsloth route first. That path kept running into runtime-level issues:

- bf16 / fp16 grad scaler crashes
- dtype mismatch errors inside LoRA kernels
- fragile package-version interactions
- extra confusion from rerunning cells in mixed notebook state

So the final engineering decision was:

1. move from free Colab to Colab Enterprise using GCP credits
2. use an L4 GPU instead of a free T4
3. keep the training self-run so the learning value stays high
4. switch from the fragile Unsloth path to the standard Hugging Face QLoRA stack

That is a strong viva answer because it shows debugging, comparison, and a justified architecture choice.

---

## 2. What this fine-tune is for

Only Task A is fine-tuned:

- Task A: quiz generation -> fine-tuned
- Task B: explanations -> still live Gemini + RAG

Reason:

- quiz generation needs strict JSON structure and consistent MCQ style
- explanations depend on the student's exact wrong answer and current retrieved notes, so live generation is better

---

## 3. Dataset snapshot

Current local dataset:

- [train.jsonl](D:/PROJECTS/2ndYearProject/EduFX_MVC/data/finetune/train.jsonl)
- [val.jsonl](D:/PROJECTS/2ndYearProject/EduFX_MVC/data/finetune/val.jsonl)

Verified facts:

- `train.jsonl` has 5 records
- `val.jsonl` has 1 record
- each record asks for exactly 15 questions
- each output contains exactly:
  - 5 easy
  - 5 medium
  - 5 hard
- topic scope in the current dataset is `mixed_inorganic`, not only s-block

Important viva point:

This dataset is enough to prove the pipeline works, but it is too small to claim production-quality generalization.

---

## 4. Notebook title and runtime

Recommended notebook title:

`EduFX_Finetune_Guide_Qwen25_7B_L4`

Runtime template used:

- Machine type: `g2-standard-4`
- GPU: `NVIDIA L4 x1`
- Python: `3.12`
- Region: `us-central1`

From the notebook screen:

1. open the notebook in Colab Enterprise
2. connect it to the L4 runtime
3. verify CUDA before installing anything

---

## 5. Cell 1 - Verify GPU

```python
import torch

print("cuda available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("GPU:", torch.cuda.get_device_name(0))
    print("bf16 supported:", torch.cuda.is_bf16_supported())
```

Expected result on the successful path:

- `cuda available: True`
- `GPU: NVIDIA L4`

If CUDA is false, reconnect the runtime before doing anything else.

---

## 6. Cell 2 - Install the stable training stack

Use the standard Hugging Face stack, not Unsloth, for the final working path.

```python
%%capture
!pip install -U transformers peft trl accelerate bitsandbytes datasets sentencepiece
```

If the notebook already contains packages from older experiments, restart the runtime after this install.

Why this stack was chosen:

- it is the standard open fine-tuning workflow
- it exposes the real training loop
- it avoids the Unsloth-specific dtype failures we hit earlier
- it is easier to explain in a viva

---

## 7. Cell 3 - Upload dataset files

Upload these two files into `/content/` using the file sidebar:

- `train.jsonl`
- `val.jsonl`

They should appear as:

- `/content/train.jsonl`
- `/content/val.jsonl`

---

## 8. Cell 4 - Load tokenizer and 4-bit base model

```python
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

MODEL_ID = "Qwen/Qwen2.5-7B-Instruct"

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.float32,
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    torch_dtype=torch.float32,
)

model.config.use_cache = False

print("Model loaded.")
print(type(model).__name__)
```

Why this mattered:

- the base model is loaded in 4-bit to reduce memory
- compute is kept in float32 for stability
- this is still QLoRA because the frozen base is quantized and only LoRA adapters are trained

---

## 9. Cell 5 - Attach LoRA adapters

```python
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=8,
    lora_alpha=16,
    lora_dropout=0.0,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules="all-linear",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

for name, param in model.named_parameters():
    if param.requires_grad:
        print("Trainable dtype:", param.dtype)
        break
```

Why `r=8`:

- enough capacity for a narrow formatting task
- safer for a tiny dataset
- lighter than a larger adapter setup

---

## 10. Cell 6 - Format the dataset

```python
from datasets import load_dataset

def format_record(row):
    messages = [
        {"role": "user", "content": row["instruction"]},
        {"role": "assistant", "content": row["output"]},
    ]
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
    )
    return {"text": text}

train_ds = load_dataset("json", data_files="/content/train.jsonl", split="train")
val_ds = load_dataset("json", data_files="/content/val.jsonl", split="train")

train_ds = train_ds.map(format_record)
val_ds = val_ds.map(format_record)

print("Train records:", len(train_ds))
print("Val records:", len(val_ds))
print(train_ds[0]["text"][:500])
```

Important detail:

- older tutorials often show raw string concatenation
- here we use the tokenizer chat template so the input matches the model family correctly

---

## 11. Cell 7 - Train

This is the exact stable training style that produced the successful run.

```python
from trl import SFTTrainer, SFTConfig

trainer = SFTTrainer(
    model=model,
    processing_class=tokenizer,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    args=SFTConfig(
        output_dir="/content/edufx-checkpoints",
        dataset_text_field="text",
        max_length=3072,
        packing=False,
        num_train_epochs=3,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        warmup_steps=5,
        logging_steps=1,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        fp16=False,
        bf16=False,
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
        report_to="none",
        seed=42,
    ),
)

trainer_stats = trainer.train()

print(f"\nTraining complete.")
print(f"Time taken: {trainer_stats.metrics['train_runtime']:.0f} seconds")
print(f"Final loss: {trainer_stats.metrics['train_loss']:.4f}")
```

Two key notes:

1. In the TRL version used here, `SFTConfig` expects `max_length`, not `max_seq_length`.
2. We kept `fp16=False` and `bf16=False` in the final stable run to avoid the dtype instability that caused earlier failures.

---

## 12. Successful training result

The actual measured values are documented in:

- [RESULT_FINETUNE.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/RESULT_FINETUNE.md)

Interpretation:

- validation loss decreased each epoch
- the model learned the task format
- the run was stable and completed successfully
- because validation has only 1 record, these numbers are encouraging but not enough for a strong quality claim

---

## 13. Cell 8 - Save the adapter

```python
SAVE_PATH = "/content/edufx-qwen25-7b-lora"

model.save_pretrained(SAVE_PATH)
tokenizer.save_pretrained(SAVE_PATH)

print("Saved to:", SAVE_PATH)
```

Optional zip and download:

```python
import shutil
from google.colab import files

shutil.make_archive("/content/edufx-qwen25-7b-lora", "zip", SAVE_PATH)
files.download("/content/edufx-qwen25-7b-lora.zip")
```

---

## 14. What to say in the viva

You can explain the work like this:

1. "We used self-run QLoRA rather than managed tuning because I wanted to learn and control the actual training loop."
2. "The first path used free Colab and Unsloth, but repeated bf16/fp16 and package-compatibility issues made that route unstable."
3. "We moved to Colab Enterprise on GCP credits with an NVIDIA L4, which gave a more reliable environment."
4. "We fine-tuned Qwen2.5-7B-Instruct in 4-bit using LoRA adapters, so memory stayed low while only a small percentage of parameters were trained."
5. "The dataset was intentionally treated as a pipeline proof: 5 training records and 1 validation record."
6. "The training completed successfully, validation loss decreased, and the result shows the pipeline works. The next step is scaling the dataset before claiming production readiness."

---

## 15. Limitations and next step

Current limitation:

- only 6 total examples were used

So this run proves:

- environment setup works
- data format works
- QLoRA training works
- adapter saving works

It does not yet prove:

- broad generalization
- robust chemistry coverage
- production-quality evaluation

The next serious step is to expand to at least 50 to 100 reviewed examples.

---

## 16. Why we did not use Vertex managed tuning for learning

Vertex tuning is still a valid production path, but it hides much of the training mechanics.

For this learning phase we intentionally wanted to understand:

- quantization
- LoRA
- chat templating
- optimizer and scheduler behavior
- train / validation loss
- adapter saving

That is why the Colab Enterprise path is the better viva story.
