# Fine-Tune & RAG Data Plan

EduFX uses two separate AI pipelines. Fine-tuning teaches the model *how to format* output. RAG injects *what to say* at runtime. Both are required.

## Pipeline Comparison

| | Fine-tuning | RAG |
|--|-------------|-----|
| Purpose | Teach EduFX JSON output format and MCQ style | Inject study facts at query time |
| Data format | JSONL | CSV → embeddings → pgvector |
| Runs during | Training (one-off) | Every API request |
| Current scope | `mixed_inorganic` (broader than s-block intentionally) | S-block notes, all 10 subtopics |
| Update cycle | Retrain adapter | Re-run ingest script |

## Current Dataset Files

```
data/finetune/train.jsonl   — 5 training records
data/finetune/val.jsonl     — 1 validation record
data/notes/s_block_notes.csv — 10 subtopics, 55 chunks in Supabase
```

## Why Fine-Tune Scope Is Broader Than S-Block

The fine-tune uses `mixed_inorganic` topics rather than only s-block because fine-tuning teaches structure, not facts. Broader chemistry variety reduces the risk of the model memorising one narrow topic. RAG then steers runtime answers back to the correct syllabus content.

**Rule:** RAG data stays aligned with the current topic scope. Fine-tune examples can be broader as long as the output format is identical.

## Fine-Tune Data Contract

Each JSONL line: `{"instruction": "...", "output": "..."}` — no wrapping array, no extra keys. Every output is a raw JSON array of exactly 15 MCQs (5 easy / 5 medium / 5 hard).

## RAG Data Contract

`data/notes/s_block_notes.csv` with columns `subtopic_id` and `body`. After editing the CSV, run the ingest pipeline:

```
write CSV → python -m app.rag.ingest → chunk (~250 words, 30-word overlap) → embed (Vertex AI) → store in content_chunks
```

## Current Status

The dataset has 6 total examples — enough to prove the pipeline works, not enough for a strong production quality claim. Expanding to 50–100 reviewed examples is the recommended next step before claiming model quality.

## Viva Summary

> "We separated style learning from fact retrieval. Fine-tuning teaches the model how EduFX wants questions formatted, while RAG injects the actual study content at runtime. That keeps the system both consistent and updatable."
