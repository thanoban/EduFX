# EduFX Fine-Tune Guide - Vertex Managed Tuning Plan

This file is the managed alternative, not the main learning path.

Current recommendation:

- for learning and viva demonstration: use [FINETUNE_COLAB_GUIDE.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/FINETUNE_COLAB_GUIDE.md)
- for later production-oriented managed tuning: use this Vertex path

---

## 0. Result reference

The current self-run fine-tune results are documented separately in:

- [RESULT_FINETUNE.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/RESULT_FINETUNE.md)

That file is the benchmark to compare against if Vertex managed tuning is attempted later.

---

## 1. When to use this path

Use Vertex managed tuning if you want:

- a Google-managed training job
- easier model hosting after training
- less notebook debugging
- less interest in the training internals

Do not use this as your primary viva story if the goal is to show that you understand self-run fine-tuning.

---

## 2. Important current limitation

The current local dataset is too small for this plan:

- `train.jsonl` = 5 examples
- `val.jsonl` = 1 example

That is enough for a notebook smoke test, but not enough for a strong managed tuning job.

Recommended minimum before Vertex tuning:

- at least 16 examples to satisfy platform constraints
- ideally 50 to 100 reviewed examples for meaningful behavior change

---

## 3. Why this path still matters

Even though we did not choose it for the final learning run, this path is still valuable because:

- EduFX already uses Vertex in the application
- deployment would be simpler if a tuned model stayed inside the same cloud ecosystem
- it avoids local CUDA, dtype, and notebook package issues

So the architecture story is:

- self-run QLoRA for learning and experimentation
- managed Vertex tuning later if the dataset becomes large enough and operations simplicity matters more

---

## 4. Data requirement

Vertex Gemini tuning expects conversation-style JSONL, not the local `instruction` / `output` pair format directly.

Local format:

```json
{"instruction": "...", "output": "..."}
```

Vertex-style format:

```json
{
  "systemInstruction": {"role": "system", "parts": [{"text": "You are an A-Level Chemistry examiner."}]},
  "contents": [
    {"role": "user", "parts": [{"text": "<instruction>"}]},
    {"role": "model", "parts": [{"text": "<output>"}]}
  ]
}
```

---

## 5. Conversion script

```python
import json

SYSTEM = "You are an A-Level Chemistry examiner."

def convert(src, dst):
    rows = []
    with open(src, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            r = json.loads(line)
            rows.append({
                "systemInstruction": {
                    "role": "system",
                    "parts": [{"text": SYSTEM}],
                },
                "contents": [
                    {"role": "user", "parts": [{"text": r["instruction"]}]},
                    {"role": "model", "parts": [{"text": r["output"]}]},
                ],
            })

    with open(dst, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

convert("data/finetune/train.jsonl", "data/finetune/vertex_train.jsonl")
convert("data/finetune/val.jsonl", "data/finetune/vertex_val.jsonl")
```

---

## 6. Recommended future workflow

If we come back to Vertex tuning later, the clean order is:

1. expand dataset to 50 to 100 reviewed examples
2. convert local JSONL to Vertex format
3. upload to Cloud Storage
4. launch the managed tuning job
5. compare tuned-model behavior against the self-run QLoRA adapter

That comparison itself would be a good extension for the project.

---

## 7. Viva summary

If asked why Vertex was not the final chosen path, the answer is:

"Vertex tuning is valid, but for this phase I wanted to learn the actual mechanics of fine-tuning. So I used Colab Enterprise with a self-run QLoRA pipeline first. Vertex remains the cleaner production path once the dataset is larger."
