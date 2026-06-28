# EduFX Fine-Tune Guide - Dataset Format Rules

This file defines the exact data contract used by the working EduFX fine-tuning notebook.

Current working environment:

- platform: Colab Enterprise on Google Cloud
- GPU: NVIDIA L4
- model: `Qwen/Qwen2.5-7B-Instruct`
- method: self-run QLoRA with standard Hugging Face tooling

The training stack changed during debugging, but the dataset contract did not.

---

## 0. Result reference

The measured outcome of the successful run is documented separately in:

- [RESULT_FINETUNE.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/RESULT_FINETUNE.md)

This file focuses on the format contract that made that run possible.

---

## 1. File format

The dataset uses JSONL.

That means:

- one JSON object per line
- no outer array
- no trailing commas

Example:

```json
{"instruction": "...", "output": "..."}
{"instruction": "...", "output": "..."}
```

Current files:

- [train.jsonl](D:/PROJECTS/2ndYearProject/EduFX_MVC/data/finetune/train.jsonl)
- [val.jsonl](D:/PROJECTS/2ndYearProject/EduFX_MVC/data/finetune/val.jsonl)

---

## 2. Required keys

Each line must contain exactly two top-level keys:

- `instruction`
- `output`

No extra top-level keys are required for the current notebook path.

---

## 3. Instruction format

The instruction should mirror the runtime prompt style.

Current pattern:

```text
You are an A-Level Chemistry examiner.
Topic: <topic>. Block: <block>. Student level: <level>.

Notes:
<context notes>

Generate exactly 15 multiple-choice A-Level chemistry questions as a JSON array.
The 15 questions must include exactly 5 easy, 5 medium, and 5 hard questions, in any order.
Each object must have exactly these keys: question_text, option_a, option_b, option_c, option_d, correct_answer (value: A, B, C, or D), difficulty (value: easy, medium, or hard).
Output raw JSON array only. No markdown, no explanation, no extra text.
```

Important:

- the current local dataset uses `Block: mixed_inorganic`
- that is acceptable because the fine-tune is teaching structure and style, not only one subtopic family

---

## 4. Output format

The `output` value is a JSON array stored as a string.

Each question object must contain:

- `question_text`
- `option_a`
- `option_b`
- `option_c`
- `option_d`
- `correct_answer`
- `difficulty`

Allowed `correct_answer` values:

- `A`
- `B`
- `C`
- `D`

Allowed `difficulty` values:

- `easy`
- `medium`
- `hard`

---

## 5. Current dataset rule

In the current EduFX fine-tune files, every record must generate:

- exactly 15 questions
- exactly 5 easy
- exactly 5 medium
- exactly 5 hard

That is the rule used in the successful training run.

---

## 6. Why this format works well

This format is good for fine-tuning because:

- it is explicit
- it is machine-checkable
- it matches the app's output needs
- it helps the model learn strict JSON structure

For EduFX, this matters more than training on vague natural-language answer style.

---

## 7. Local validation checklist

Before uploading the files to Colab:

1. check that every line is valid JSON
2. check that every line has `instruction` and `output`
3. check that every `output` parses to a 15-item array
4. check that the difficulty split is exactly 5 / 5 / 5

Example validation script:

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

print("Dataset format looks valid.")
```

---

## 8. Chat-template note

The raw dataset does not contain model-specific wrapper tokens.

Those are added at notebook time by the tokenizer chat template.

That is important because:

- the data contract stays model-agnostic
- the notebook can change model family later
- only the wrapping step changes, not the stored JSONL

---

## 9. Current limitation

The format is correct, but the dataset is still tiny:

- 5 training examples
- 1 validation example

So this dataset is best described as:

- structurally correct
- sufficient for pipeline verification
- not yet sufficient for strong model-quality claims

---

## 10. Viva summary

Good viva sentence:

"We kept the training data contract very strict: one instruction-output pair per line, raw JSON output only, and an exact 15-question difficulty split. That made the data easy to validate and aligned it directly with the app's required response format."
