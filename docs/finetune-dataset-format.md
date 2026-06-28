# Fine-Tune Dataset Format

The dataset contract used by the working Colab Enterprise run. The training stack changed during debugging; this format did not.

## File Format

JSONL — one JSON object per line, no outer array, no trailing commas.

```json
{"instruction": "...", "output": "..."}
{"instruction": "...", "output": "..."}
```

Files: `data/finetune/train.jsonl` (5 records) · `data/finetune/val.jsonl` (1 record)

## Required Keys

Each line must have exactly two top-level keys: `instruction` and `output`. No extras.

## Instruction Template

```
You are an A-Level Chemistry examiner.
Topic: <topic>. Block: <block>. Student level: <level>.

Notes:
<context notes>

Generate exactly 15 multiple-choice A-Level chemistry questions as a JSON array.
The 15 questions must include exactly 5 easy, 5 medium, and 5 hard questions, in any order.
Each object must have exactly these keys: question_text, option_a, option_b, option_c,
option_d, correct_answer (value: A, B, C, or D), difficulty (value: easy, medium, or hard).
Output raw JSON array only. No markdown, no explanation, no extra text.
```

The current dataset uses `Block: mixed_inorganic` — intentionally broader than s-block so the model learns format rather than memorising one topic.

## Output Schema

Each question object:

| Key | Allowed values |
|-----|----------------|
| `question_text` | string |
| `option_a` – `option_d` | string |
| `correct_answer` | `A` `B` `C` `D` |
| `difficulty` | `easy` `medium` `hard` |

Every record must contain exactly **15 questions** — 5 easy, 5 medium, 5 hard.

## Chat Template Note

The raw JSONL does not contain model-specific tokens. The notebook wraps each record at training time using `tokenizer.apply_chat_template()`. This keeps the data format model-agnostic — if you switch base models, only the wrapping step changes.

## Validation Script

Run before uploading to Colab:

```python
import json
from collections import Counter

for path in ["data/finetune/train.jsonl", "data/finetune/val.jsonl"]:
    with open(path, encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            row = json.loads(line)
            questions = json.loads(row["output"])
            assert len(questions) == 15, (path, i, len(questions))
            counts = Counter(q["difficulty"] for q in questions)
            assert counts == {"easy": 5, "medium": 5, "hard": 5}, (path, i, counts)

print("Dataset format valid.")
```

## Viva Summary

> "We kept the data contract strict: one instruction-output pair per line, raw JSON output only, exact 15-question difficulty split. That made the dataset machine-checkable and aligned it directly with the app's required response format."
