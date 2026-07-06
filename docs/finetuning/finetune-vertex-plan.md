# Vertex Managed Tuning Plan

This is the managed-tuning alternative to the Colab self-run path. It was not used for the primary viva run. Use [finetune-colab-guide.md](finetune-colab-guide.md) for the path that actually ran.

## When to Use This Path

Vertex managed tuning is worth considering when the dataset grows large enough to justify it (50+ examples) and you want Google-managed infrastructure with simpler hosting. For the viva, the self-run QLoRA path is the better story because it demonstrates understanding of the training mechanics.

## Data Format Difference

The local JSONL format is not directly compatible with Vertex. A conversion step is required.

**Local format:**
```json
{"instruction": "...", "output": "..."}
```

**Vertex format:**
```json
{
  "systemInstruction": {"role": "system", "parts": [{"text": "You are an A-Level Chemistry examiner."}]},
  "contents": [
    {"role": "user",  "parts": [{"text": "<instruction>"}]},
    {"role": "model", "parts": [{"text": "<output>"}]}
  ]
}
```

## Conversion Script

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
                "systemInstruction": {"role": "system", "parts": [{"text": SYSTEM}]},
                "contents": [
                    {"role": "user",  "parts": [{"text": r["instruction"]}]},
                    {"role": "model", "parts": [{"text": r["output"]}]},
                ],
            })
    with open(dst, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

convert("data/finetune/train.jsonl", "data/finetune/vertex_train.jsonl")
convert("data/finetune/val.jsonl",   "data/finetune/vertex_val.jsonl")
```

## Minimum Dataset Size

Vertex managed tuning requires at least 16 examples to satisfy platform constraints. The current dataset (5 train + 1 val) is too small. Expand to 50–100 reviewed examples before using this path.

## Recommended Future Workflow

1. Expand dataset to 50–100 examples
2. Run the conversion script above
3. Upload to GCS: `gs://edufx-finetune/vertex_train.jsonl`
4. Launch the managed tuning job in the GCP Console → Vertex AI → Fine-tuning
5. Compare tuned-model output against the self-run QLoRA adapter from [finetune-results.md](finetune-results.md)

## Viva Answer

> "Vertex managed tuning is a valid production path, but for this phase I wanted to understand the actual mechanics — quantisation, adapters, loss curves. Vertex hides those details. Once the dataset grows large enough, managed tuning would simplify operations."
