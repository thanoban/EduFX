# EduFX — Data Format Guide
> How to prepare your chemistry notes for RAG and Fine-tuning

---

## The Simple Answer Up Front

You **do not** need to split your notes by beginner / intermediate / advanced.
You **do not** need to label difficulty levels in your training data.

Just write your notes per topic — one set per subtopic — and the system handles the rest.

---

## Overview

| Purpose | What you make | Where it goes |
|---|---|---|
| **RAG** | One text block per topic -> CSV | Supabase `content_chunks` table through the ingest script |
| **Fine-tuning** | JSONL with instruction/output pairs | Google Colab for training |

---

## Part 1 — RAG: Formatting Your Notes

### The rule: one row per subtopic

The `content` table needs:

| column | what goes here |
|---|---|
| `subtopic_id` | integer ID matching the `subtopics` table |
| `level` | just put `"all"` — or omit it, see note below |
| `body` | your full notes for that topic as plain text |

> **Why no level split?**
> The ingest script chunks your notes into ~250-word pieces and embeds them as vectors.
> At query time, RAG retrieves the most *relevant* chunks regardless of level label.
> The relevance comes from the content of your writing, not from a category tag.
> One good set of notes per topic is enough.

So for **Group 1 Reactions** you only need **1 row**, not 3:

```
subtopic_id=2 | body="Group 1 reactivity increases down the group because the outer
electron is further from the nucleus and is shielded by more inner shells..."
```

---

### What your notes should look like

Write them as **flowing paragraphs** covering the topic fully — from basics through to exam-level detail. Include everything in one body:

```
Group 1 elements are the alkali metals: Li, Na, K, Rb, Cs, Fr. They each have
one electron in their outer shell, making them highly reactive.

Reactivity increases down the group. This is because the outer electron is
progressively further from the nucleus and more shielded by inner shells, so
less energy (lower ionisation energy) is needed to remove it.

Reaction with water:
2Na(s) + 2H2O(l) → 2NaOH(aq) + H2(g)
The product is an alkaline solution (pH > 7) and hydrogen gas is released.
Lithium fizzes gently, sodium moves rapidly and may ignite, potassium burns
with a lilac flame, and caesium reacts explosively.

Anomaly: lithium has a more negative standard electrode potential (E° = -3.04V)
than caesium (-3.03V), yet caesium is more reactive in water. This is because
water reactivity depends on ionisation energy (dominant factor), hydration
enthalpy, and melting point — not electrode potential alone.
```

Cover simple facts, trends with reasons, equations with explanations, and any exam-level anomalies — all in one block. The chunker will split it; RAG will retrieve only what is relevant to each query.

---

### What NOT to do in your notes

| ❌ Avoid | ✅ Do instead |
|---|---|
| Only bullet points | Flowing paragraphs — bullets break chunking |
| Very short notes (under 150 words) | Write at least 200–400 words per topic |
| Equations with no explanation | Always say what the equation means |
| Copying textbook word for word | Paraphrase — the model learns your style |
| Separate files for each level | One file, all depth levels in one body |

---

### CSV format to load into Supabase

Save as `data/notes/s_block_notes.csv`:

```csv
subtopic_id,body
1,"Group 1 elements are the alkali metals Li Na K Rb Cs Fr. They each have one electron in their outer shell making them highly reactive. Reactivity increases down the group because..."
2,"Group 1 reactivity increases down the group because the outer electron is further from the nucleus and is shielded by more inner shells. Reaction with water: 2Na + 2H2O → 2NaOH + H2..."
3,"The thermal stability of Group 1 carbonates and nitrates increases down the group. This is because larger cations with lower charge density polarise the anion less..."
```

**Tips:**
- Wrap every body in double quotes `"..."`
- If your notes contain a `"`, write it as `""` (two quotes)
- Keep each row on one line — no actual line breaks inside a cell
- Save as UTF-8

Ingest via the project CLI:

```powershell
cd D:\PROJECTS\2ndYearProject\EduFX_MVC\server
python -m app.rag.ingest
```

The ingest script then:
1. Reads every row from `data/notes/*.csv`
2. Splits body into ~250-word chunks with 30-word overlap
3. Embeds each chunk with Vertex AI `gemini-embedding-001` (384-dim vector)
4. Stores in `content_chunks` for similarity search

---

### Your subtopics and their IDs

Check the IDs before filling the CSV:

```sql
SELECT id, group_name, title FROM subtopics ORDER BY id;
```

Seeded list (from `server/app/core/store.py`):

```
id=1   group1   Group Trends
id=2   group1   Reactions of Group 1 Elements
id=3   group1   Thermal Stability of Salts
id=4   group1   Solubility of Group 1 Salts
id=5   group1   Flame Test
id=6   group2   Group Trends
id=7   group2   Reactions of Group 2 Elements
id=8   group2   Thermal Stability of Salts
id=9   group2   Solubility of Group 2 Salts
id=10  group2   Flame Test
```

Add P-block and D-block subtopics to the `subtopics` table first, then get their IDs.

---

## Part 2 — Fine-tuning: Training Data Format

### No level or difficulty categories needed

Fine-tuning teaches the model **how to write a good A-Level chemistry MCQ in the right JSON format**. It does not need to know about beginner/intermediate/advanced to learn that.

Your instruction is simply: topic name + notes → generate questions.
The model learns the format. The difficulty column in the output JSON is still included, but it can be a mix — the model will learn to generate a natural spread.

---

### The file format

One JSON object per line — called **JSONL** (JSON Lines).
Save as `data/finetune/training_data.jsonl`.

Every line has exactly two keys:
```
{"instruction": "...the prompt...", "output": "...the answer..."}
```

No wrapping array. No trailing commas. One JSON object per line, nothing else.

---

### Task A — Quiz generation examples

**Template (no level needed):**
```
instruction = "You are an A-Level Chemistry examiner. Topic: {subtopic_title}. Group: {group_name}.\n\nNotes:\n{your notes body}\n\nGenerate 5 multiple-choice A-Level chemistry questions as a JSON array. Each object must have: question_text, option_a, option_b, option_c, option_d, correct_answer (A/B/C/D), difficulty (easy/medium/hard)."

output = "[...5 questions as JSON array...]"
```

**Real example line:**
```jsonl
{"instruction": "You are an A-Level Chemistry examiner. Topic: Reactions of Group 1 Elements. Group: group1.\n\nNotes:\nGroup 1 reactivity increases down the group because the outer electron is further from the nucleus and is shielded by more inner shells. This means less energy is needed to remove it.\n\nReaction with water: 2Na(s) + 2H2O(l) → 2NaOH(aq) + H2(g). The metal dissolves forming an alkaline solution and releasing hydrogen gas. Caesium reacts explosively because it has the lowest first ionisation energy.\n\nGenerate 5 multiple-choice A-Level chemistry questions as a JSON array. Each object must have: question_text, option_a, option_b, option_c, option_d, correct_answer (A/B/C/D), difficulty (easy/medium/hard).", "output": "[{\"question_text\": \"Why does potassium react more vigorously with water than sodium?\", \"option_a\": \"Potassium has a higher melting point\", \"option_b\": \"Potassium has a lower first ionisation energy\", \"option_c\": \"Potassium has fewer electrons\", \"option_d\": \"Potassium has a higher nuclear charge\", \"correct_answer\": \"B\", \"difficulty\": \"medium\"}, {\"question_text\": \"What gas is released when sodium reacts with water?\", \"option_a\": \"Oxygen\", \"option_b\": \"Carbon dioxide\", \"option_c\": \"Hydrogen\", \"option_d\": \"Nitrogen\", \"correct_answer\": \"C\", \"difficulty\": \"easy\"}, {\"question_text\": \"What is the pH of the solution formed when lithium reacts with water?\", \"option_a\": \"Below 7\", \"option_b\": \"Exactly 7\", \"option_c\": \"Above 7\", \"option_d\": \"Cannot be determined\", \"correct_answer\": \"C\", \"difficulty\": \"easy\"}, {\"question_text\": \"Which Group 1 metal reacts most vigorously with water?\", \"option_a\": \"Lithium\", \"option_b\": \"Sodium\", \"option_c\": \"Potassium\", \"option_d\": \"Caesium\", \"correct_answer\": \"D\", \"difficulty\": \"medium\"}, {\"question_text\": \"What is the role of the Group 1 metal in its reaction with water?\", \"option_a\": \"Oxidising agent\", \"option_b\": \"Reducing agent\", \"option_c\": \"Catalyst\", \"option_d\": \"Spectator ion\", \"correct_answer\": \"B\", \"difficulty\": \"hard\"}]"}
```

**How many do you need?**
- Aim for **4–5 lines per subtopic**
- 10 subtopics × 4 examples = **~40–50 Task A lines**
- That is enough for the model to learn the format

**Where does the output come from?**
Two options:
1. Write the questions yourself (best quality, catches errors)
2. Generate with Vertex AI Gemini, review each question, then use as output

---

### Task B — Explanation examples

The model learns how to explain a wrong answer in plain English.
No level category needed here either — just include the question context.

**Template:**
```
instruction = "You are an A-Level Chemistry teacher.\n\nQuestion: {question_text}\nOption A: {option_a}\nOption B: {option_b}\nOption C: {option_c}\nOption D: {option_d}\nStudent answered: {student_answer}\nCorrect answer: {correct_answer}\n\nExplain in 2-3 sentences why the correct answer is right and why the student answer is wrong. Plain text only."

output = "...2-3 sentence plain text explanation..."
```

**Real example line:**
```jsonl
{"instruction": "You are an A-Level Chemistry teacher.\n\nQuestion: Why does potassium react more vigorously with water than sodium?\nOption A: Potassium has a higher melting point\nOption B: Potassium has a lower first ionisation energy\nOption C: Potassium has fewer electrons\nOption D: Potassium has a higher nuclear charge\nStudent answered: A\nCorrect answer: B\n\nExplain in 2-3 sentences why the correct answer is right and why the student answer is wrong. Plain text only.", "output": "The correct answer is B because potassium's outer electron is in a higher energy shell, further from the nucleus and more shielded, so less energy is needed to remove it. This lower ionisation energy means potassium loses its electron more easily than sodium and reacts faster with water. Melting point has no significant effect on reactivity with water in Group 1."}
```

**Where does the output come from?**
- Pull from Supabase `quiz_attempts` table — the `explanation` column already has AI-generated explanations from prior sessions
- Use the export script below

**How many do you need?**
- Aim for **50–80 Task B lines**
- **Total JSONL target: ~100–130 lines** (50 Task A + 80 Task B)

---

### Export script — pull Task B from Supabase automatically

Save as `server/notebooks/export_training_data.py`:

```python
import json
from dotenv import load_dotenv
import os
from supabase import create_client

load_dotenv()
db = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

rows = (
    db.table("quiz_attempts")
    .select("*, questions(*)")
    .eq("is_correct", False)
    .not_.is_("explanation", "null")
    .execute()
    .data
)

lines = []
for row in rows:
    q = row["questions"]
    instruction = (
        "You are an A-Level Chemistry teacher.\n\n"
        f"Question: {q['question_text']}\n"
        f"Option A: {q['option_a']}\nOption B: {q['option_b']}\n"
        f"Option C: {q['option_c']}\nOption D: {q['option_d']}\n"
        f"Student answered: {row['student_answer']}\n"
        f"Correct answer: {row['correct_answer']}\n\n"
        "Explain in 2-3 sentences why the correct answer is right and why "
        "the student answer is wrong. Plain text only."
    )
    lines.append({"instruction": instruction, "output": row["explanation"]})

with open("data/finetune/task_b_explanations.jsonl", "w") as f:
    for line in lines:
        f.write(json.dumps(line) + "\n")

print(f"Exported {len(lines)} Task B examples")
```

---

## Part 3 — Folder Structure

```
EduFX_MVC/
├── data/
│   ├── notes/
│   │   ├── s_block_notes.csv          ← one row per subtopic (no level split)
│   │   ├── p_block_notes.csv          ← add when ready
│   │   └── d_block_notes.csv          ← add when ready
│   └── finetune/
│       ├── training_data.jsonl        ← final merged file → upload to Colab
│       ├── task_a_quiz_gen.jsonl      ← quiz generation examples
│       └── task_b_explanations.jsonl  ← explanation examples
└── server/
    └── notebooks/
        ├── export_training_data.py    ← pulls Task B from Supabase
        └── finetune_gemma2.ipynb      ← Colab training notebook
```

---

## Part 4 — Quick Checklist

### RAG notes (notes CSV)

- [ ] One row per subtopic — no level split needed
- [ ] Each body is at least 200 words (more = better retrieval)
- [ ] Notes are written in flowing paragraphs, not just bullet points
- [ ] Equations are included with explanations
- [ ] `subtopic_id` values match actual IDs in the `subtopics` table
- [ ] File saved as UTF-8 CSV

### Fine-tuning data (JSONL)

- [ ] Each line is valid JSON — test with:
  `python -c "import json; [json.loads(l) for l in open('training_data.jsonl')]"`
- [ ] Every line has both `instruction` and `output` keys
- [ ] No level or difficulty category required in the instruction
- [ ] Task A outputs are valid JSON arrays of 5 questions
- [ ] Task B outputs are plain text, 2–3 sentences, no bullet points
- [ ] At least 100 total lines (target 130, cap at 500)
- [ ] No duplicate lines

---

## Part 5 — How It Flows at Runtime

```
Student requests a quiz on "Reactions of Group 1 Elements"
                │
                ▼
RAG retriever searches content_chunks using vector similarity
                │
                ▼
Top 5 most relevant chunks retrieved from YOUR notes
                │
                ▼
Chunks added to the AI prompt as context
                │
                ▼
Fine-tuned model (Gemma 2B) or Vertex AI (Gemini)
generates 15 questions grounded in your actual notes
                │
                ▼
Student gets a chemistry quiz built from what they studied
```

**The quality of your notes = the quality of the quiz.**
Generic notes → generic questions. Detailed notes with real equations and reasoning → precise, exam-relevant questions.
