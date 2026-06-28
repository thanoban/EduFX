# EduFX Fine-Tune Guide - Data Plan for Fine-Tuning and RAG

This file explains how EduFX data is split between two different AI jobs:

- fine-tuning
- RAG

Current June 2026 implementation context:

- final successful fine-tune path: Colab Enterprise + NVIDIA L4 + Qwen2.5-7B-Instruct + standard Hugging Face QLoRA
- current local fine-tune files:
  - `data/finetune/train.jsonl`
  - `data/finetune/val.jsonl`
- current RAG notes file:
  - `data/notes/s_block_notes.csv`

---

## 0. Result reference

The actual fine-tune metrics are documented separately in:

- [RESULT_FINETUNE.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/RESULT_FINETUNE.md)

This file focuses on the data design rather than repeating the training results.

---

## 1. The two pipelines are different

| Area | Fine-tuning | RAG |
|---|---|---|
| Purpose | teach the model EduFX output format and MCQ style | inject study facts at runtime |
| Main data format | JSONL | CSV -> embeddings -> pgvector |
| Where it runs | training notebook | application runtime |
| Current scope | mixed inorganic in the training set | s-block notes in the notes CSV |
| What changes when data changes | retrain adapter | re-ingest chunks |

Important idea:

- fine-tuning does not store all chemistry knowledge for the app
- RAG is what gives the app topic-specific study material at runtime

---

## 2. Current fine-tune dataset status

Current verified counts:

- `train.jsonl` = 5 records
- `val.jsonl` = 1 record

Current verified structure:

- each record has `instruction` and `output`
- each output is a JSON array of 15 MCQs
- each output contains exactly:
  - 5 easy
  - 5 medium
  - 5 hard

What this means:

- the dataset is structurally valid
- the dataset is enough for a successful pipeline demonstration
- the dataset is too small for a strong production claim

---

## 3. What is fine-tuned and what is not

| Task | Fine-tune? | Served by |
|---|---|---|
| Task A - Quiz Generation | Yes | LoRA adapter trained on Qwen2.5-7B-Instruct |
| Task B - Explanations | No | live Gemini + RAG |

Why Task B stays live:

- explanation quality depends on the exact wrong option selected by the student
- explanation prompts also depend on retrieved content for that topic
- that is better handled by a live model call than by a narrow fine-tune

---

## 4. Fine-tune data scope rule

Fine-tune data does not need to be limited to s-block.

That is why the current training file uses `mixed_inorganic`.

Why this is reasonable:

- fine-tuning is teaching output structure and question style
- more chemistry variety reduces memorization of one tiny topic family
- the app can still use RAG later to steer answers back toward the required syllabus content

So the practical rule is:

- RAG facts should stay aligned with the app's current topic scope
- fine-tuning examples can be broader as long as the output format stays identical

---

## 5. Fine-tune file contract

Each fine-tune line must be:

```json
{"instruction": "...", "output": "..."}
```

Requirements:

- one JSON object per line
- no wrapping array
- `instruction` must match the runtime prompt style
- `output` must be raw JSON only

This is the exact contract used by the successful training run.

---

## 6. RAG data contract

RAG still uses:

- `data/notes/s_block_notes.csv`

Core columns:

- `subtopic_id`
- `body`

The CSV is local staging data only. It is not the vector store itself.

Flow:

1. write or edit the CSV
2. run the ingest script
3. chunk the notes
4. embed the chunks
5. store them in `content_chunks`

---

## 7. Why both systems are needed

Fine-tuning alone is not enough because:

- it teaches style, not all current factual context
- chemistry content may change with syllabus emphasis or note improvements

RAG alone is not enough because:

- it does not reliably force the exact EduFX JSON structure
- it does not by itself teach consistent MCQ formatting

So the combined design is:

- fine-tune for structure and style
- RAG for current study facts

That is one of the most important project-level architecture points to explain in the viva.

---

## 8. Recommended next data step

Before claiming strong fine-tune quality:

1. expand from 6 total examples to at least 50 to 100 reviewed examples
2. keep the same `instruction` / `output` contract
3. keep the 15-question and 5/5/5 difficulty rule
4. review correctness carefully before retraining

---

## 9. Viva summary

A clean way to explain the data design is:

"We separated style learning from fact retrieval. Fine-tuning teaches the model how EduFX wants questions formatted, while RAG injects the actual study content at runtime. That keeps the system both consistent and adaptable."
