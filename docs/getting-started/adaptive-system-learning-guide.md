# EduFX Adaptive System Learning Guide

This guide explains the full adaptive-learning part of EduFX from the basics.
It is written for someone who wants to learn the system through this project,
not just run it.

If you currently feel "I do not understand the agent, the models, or the
integration", start here first.

## What EduFX Is Doing

EduFX is not just "one AI model". It is a pipeline with different parts doing
different jobs:

1. The recommender models estimate what a student likely knows.
2. The scheduling agent turns those estimates into a realistic daily plan.
3. The quiz generation layer creates new questions for a student's level.
4. The explanation layer explains wrong answers using notes plus an LLM.
5. The RAG layer supplies topic-specific grounding text to the LLM features.

So the system is adaptive in two different ways:

- Adaptive recommendation:
  decide what to study next
- Adaptive content generation:
  decide what kind of quiz or explanation to generate

## The Big Picture

```text
Student logs in
  -> completes diagnostic
  -> gets progress records per subtopic
  -> studies a topic
  -> takes a quiz
  -> quiz result updates progress + streak
  -> recommender ranks all subtopics
  -> scheduling agent caps that list for today
  -> dashboard shows today's plan
```

At the same time:

```text
If student has prior sessions on a subtopic
  -> quiz service tries AI quiz generation
  -> fine-tuned model / Gemini / Groq / Vertex candidate order
  -> weak concepts + RAG context are injected into the prompt
```

And for explanations:

```text
Wrong answer
  -> retrieve relevant notes chunks
  -> explanation prompt
  -> Gemini / Groq / Vertex candidate order
  -> short explanation returned
```

## System Layers

### 1. Recommendation and Scheduling

This is the "what should I study next?" part.

Relevant files:

- [server/app/services/scheduling_agent.py](../server/app/services/scheduling_agent.py)
- [server/app/ml/recommender_engine.py](../server/app/ml/recommender_engine.py)
- [server/app/ml/recommender.py](../server/app/ml/recommender.py)
- [server/app/ml/dkt.py](../server/app/ml/dkt.py)
- [server/app/ml/bkt.py](../server/app/ml/bkt.py)

### 2. Quiz Generation

This is the "generate questions for this student" part.

Relevant files:

- [server/app/services/quiz_service.py](../server/app/services/quiz_service.py)
- [server/app/services/ai_service.py](../server/app/services/ai_service.py)
- [../finetuning/finetune-method.md](../finetuning/finetune-method.md)
- [../finetuning/finetune-results.md](../finetuning/finetune-results.md)

### 3. Explanations and RAG

This is the "explain the student's mistake using topic notes" part.

Relevant files:

- [server/app/services/explanation_service.py](../server/app/services/explanation_service.py)
- [server/app/repositories/rag_repository.py](../server/app/repositories/rag_repository.py)
- [server/app/rag/retriever.py](../server/app/rag/retriever.py)
- [server/app/rag/embedder.py](../server/app/rag/embedder.py)

## Recommendation System From Basic Concepts

### What problem are we solving?

A student does not need every topic every day.

We need to decide:

- which topic is weak
- which topic is overdue for revision
- which new topic is unlocked by prerequisites
- which topic is in the right challenge zone

That is what the recommender plus scheduling agent does.

### Why two trained recommender models?

EduFX uses two knowledge-tracing models:

- `BKT`:
  Bayesian Knowledge Tracing, classical and interpretable
- `DKT`:
  Deep Knowledge Tracing, an LSTM sequence model

Why both?

- BKT is easier to explain and is a good baseline
- DKT can learn cross-topic transfer that BKT cannot
- comparing both gives stronger academic evidence

### What data do these models read?

They do not read raw chemistry notes. They read student interaction history:

- subtopic attempted
- correct or wrong
- focus score
- whether focus tracking was enabled

That history is flattened into a sequence in
[server/app/ml/recommender.py](../server/app/ml/recommender.py).

### Why was synthetic data used?

Deep sequence models need many student histories. At the start of the project,
there were not enough real EduFX student logs, so the recommender training
pipeline used a simulator to generate realistic sequences.

The simulator is documented in
[../ml-recommender/recommender-colab-training.md](../ml-recommender/recommender-colab-training.md)
and explained slowly in
[../ml-recommender/recommender-learning-basics.md](../ml-recommender/recommender-learning-basics.md).

## Recommender Flow In Code

This is the actual backend flow:

```text
/scheduler/todays-plan/{student_id}
  -> SchedulerController
  -> SchedulingAgent.get_todays_plan()
  -> RecommenderEngine.rank_candidates()
  -> DKTInference.load() if available
  -> else BKTModel.load() if available
  -> else rule-based fallback
  -> return ranked subtopics
  -> SchedulingAgent caps by availability
  -> frontend gets today's plan
```

Files:

- Route:
  [server/app/routes/scheduler.py](../server/app/routes/scheduler.py)
- Controller:
  [server/app/controllers/scheduler_controller.py](../server/app/controllers/scheduler_controller.py)
- Agent:
  [server/app/services/scheduling_agent.py](../server/app/services/scheduling_agent.py)
- Ranking engine:
  [server/app/ml/recommender_engine.py](../server/app/ml/recommender_engine.py)

## Scheduling Agent Role

The scheduling agent is not the same thing as the trained model.

The trained model says:

- "this topic seems weak"
- "this topic seems strong"
- "this topic is likely answerable with probability x"

The scheduling agent then applies real product rules:

- how many topics today
- whether today is a free day
- whether the student promised to study today
- how to mix weak and strong topics
- how to update streaks after study

That separation is good design:

- `RecommenderEngine` decides what is important
- `SchedulingAgent` decides what is practical today

## Recommender Results and Measured Performance

### Knowledge-tracing quality

Fresh synthetic holdout results used in the project:

| Model | Held-out ROC-AUC |
|------|------------------:|
| Base-rate baseline | 0.5000 |
| BKT | 0.6569 |
| DKT | 0.6822 |

DKT beat BKT by `+0.0253`.

Interpretation:

- both models learned useful signal
- DKT performed best
- the gain is real but not huge, which is normal on a small syllabus

Important honesty note:

These are synthetic-holdout numbers. They validate the artifact and pipeline,
but they do not prove real classroom impact yet.

### Recommender latency

Measured inference latency on a 55-step history from prior project evaluation:

| Model | Inference latency |
|------|-------------------:|
| BKT | 0.2366 ms |
| DKT | 1.3075 ms |

So DKT is slower than BKT, but still extremely fast.

### Current backend route performance

The live scheduler route was recently profiled and optimized in this repo.

After bulk-loading session attempts instead of doing one query per session:

- local cold-start agent:
  p95 about `0.024 ms`
- local DKT-history agent:
  p95 about `3.236 ms`
- Supabase `/scheduler/todays-plan` route:
  median about `0.94 s`

The remaining delay is mostly database/network time, not model math.

## Fine-Tuned Quiz Model

EduFX also has a separate trained model for quiz generation.

This is a different problem from recommendation:

- recommender models predict what the student should study next
- fine-tuned LLM generates new MCQ questions in EduFX format

### Model and method

The trained quiz model setup was:

- base model:
  `Qwen/Qwen2.5-7B-Instruct`
- method:
  QLoRA
- hardware:
  Colab Enterprise, NVIDIA L4
- stack:
  `transformers`, `peft`, `trl`, `bitsandbytes`, `accelerate`, `datasets`

### Fine-tune results

| Metric | Value |
|------|-------|
| Runtime | 263 seconds |
| Final training loss | 1.3884 |
| Train records | 5 |
| Validation records | 1 |

Per-epoch results:

| Epoch | Train Loss | Val Loss | Token Accuracy |
|------:|-----------:|---------:|---------------:|
| 1 | 1.6117 | 1.2146 | 74.3% |
| 2 | 1.2979 | 1.1323 | 75.2% |
| 3 | 1.1886 | 1.0471 | 76.0% |

Interpretation:

- the adapter learned the target JSON format
- training was successful
- dataset is too small for strong production claims

See:

- [../finetuning/finetune-results.md](../finetuning/finetune-results.md)
- [../finetuning/finetune-method.md](../finetuning/finetune-method.md)
- [../finetuning/finetune-colab-guide.md](../finetuning/finetune-colab-guide.md)

## Quiz Generation Integration Method

The quiz generation integration is not "always use one provider".

Current provider order in
[server/app/services/ai_service.py](../server/app/services/ai_service.py) is:

```text
Fine-tuned endpoint
  -> Gemini API key
  -> Groq
  -> Vertex
```

That means:

- if the self-hosted fine-tuned model is live, it is used first
- if not, the backend falls back automatically
- the feature still works even when the fine-tuned host is offline

The quiz service integration is in
[server/app/services/quiz_service.py](../server/app/services/quiz_service.py).

For personalized quizzes it combines:

- student level
- current subtopic notes
- RAG chunks
- weak concepts from previous mistakes

Then it asks the LLM for exactly 15 questions.

## Explanation Integration Method

Explanations are handled differently from quiz generation.

The project intentionally does not use the fine-tuned model for explanations.

Reason:

- explanations depend on the exact wrong answer
- explanations need live note context
- that is better handled by runtime generation plus RAG

Current explanation provider order:

```text
Gemini API key
  -> Groq
  -> Vertex
```

File:

- [server/app/services/explanation_service.py](../server/app/services/explanation_service.py)

## RAG Integration Method

RAG means Retrieval-Augmented Generation.

In EduFX it works like this:

1. Store note chunks for each subtopic in Supabase `content_chunks`
2. Embed the user query or topic query
3. Retrieve top matching chunks
4. Add them into the LLM prompt

Current implementation note:

The original Supabase RPC path for pgvector retrieval was unreliable, so the
project now retrieves rows from `content_chunks` and does cosine ranking in
Python. That current logic is in
[server/app/rag/retriever.py](../server/app/rag/retriever.py).

This is a good example of practical engineering:

- the planned architecture was more "database-native"
- the observed runtime behaviour was flaky
- the implementation was changed to the simpler reliable option

## Where the Main Adaptive Files Live

```text
server/app/
  core/
    container.py
    rules.py
  ml/
    recommender.py
    recommender_engine.py
    bkt.py
    dkt.py
    artifacts/
  services/
    scheduling_agent.py
    quiz_service.py
    explanation_service.py
    results_service.py
    ai_service.py
  rag/
    embedder.py
    retriever.py
  repositories/
    rag_repository.py
    scheduler_repository.py
    progress_repository.py
    results_repository.py
    supabase_*.py
```

## How the Pieces Connect

The full dependency wiring happens in
[server/app/core/container.py](../server/app/core/container.py).

That file creates:

- repositories
- `RecommenderEngine`
- `SchedulingAgent`
- `QuizService`
- `ExplanationService`
- `ResultsService`

This is the place to read if you want to understand how the project is glued
together.

## Best Learning Order

If you are new to this kind of development, study in this order:

1. Read [../ml-recommender/recommender-learning-basics.md](../ml-recommender/recommender-learning-basics.md)
2. Read [agent-learning-guide.md](agent-learning-guide.md)
3. Read [server/app/core/container.py](../server/app/core/container.py)
4. Read [server/app/services/scheduling_agent.py](../server/app/services/scheduling_agent.py)
5. Read [server/app/ml/recommender_engine.py](../server/app/ml/recommender_engine.py)
6. Read [server/app/ml/recommender.py](../server/app/ml/recommender.py)
7. Read [../finetuning/finetune-method.md](../finetuning/finetune-method.md)
8. Read [../finetuning/finetune-results.md](../finetuning/finetune-results.md)
9. Read [server/app/services/quiz_service.py](../server/app/services/quiz_service.py)
10. Read [server/app/services/explanation_service.py](../server/app/services/explanation_service.py)

## Short Viva Version

If you need a short explanation in a viva, say this:

> EduFX uses a layered adaptive-learning architecture. For recommendation, the
> backend builds a student interaction history from quiz attempts and focus
> signals, then runs DKT first, BKT second, and rule-based fallback if there is
> not enough data. The SchedulingAgent converts that ranking into a realistic
> daily plan using availability and session length. For quiz generation, a
> fine-tuned Qwen adapter is tried first, then general LLM fallbacks. For wrong
> answer explanations, the system retrieves note chunks and generates a short
> explanation with a live LLM. So recommendation, generation, and explanation
> are separate adaptive layers, not one single model.
