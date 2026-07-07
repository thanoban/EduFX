# EduFX Agent Learning Guide

This guide explains the real agent structure that exists in EduFX today.

The important update is this:

EduFX no longer has only one "agent" idea.

It now has **two agent families**:

1. **Deterministic planning agent**
   - `SchedulingAgent`
   - decides how much study content to serve today
   - never calls an LLM
2. **LangGraph AI agent layer**
   - AI teacher graph
   - quiz self-check graph
   - both use LLMs, but both are grounded and read-only

So if someone asks, "What are the agents in EduFX?", the correct answer is:

> EduFX has one deterministic scheduling agent for planning, and a separate
> LangGraph agent layer for AI teacher responses and quiz-quality review.

---

## 1. The Three Actual Agents

### A. `SchedulingAgent`

File:

- [server/app/services/scheduling_agent.py](../../server/app/services/scheduling_agent.py)

Purpose:

- take the recommender's ranked subtopics
- cap them by student availability and session length
- keep weak/strong balance
- update streak data after completed study sessions

This is **not** an LLM agent.
It is a deterministic product-policy agent.

### B. AI Teacher Graph

Files:

- [server/app/agents/teacher_graph.py](../../server/app/agents/teacher_graph.py)
- [server/app/agents/dossier.py](../../server/app/agents/dossier.py)
- [server/app/services/teacher_service.py](../../server/app/services/teacher_service.py)
- [server/app/routes/teacher.py](../../server/app/routes/teacher.py)

Purpose:

- answer student questions about their own progress
- generate an auto-written progress report
- use the student's real study data as grounding context

This is a **LangGraph supervisor-style agent**.

### C. Quiz Self-Check Graph

Files:

- [server/app/agents/quiz_review.py](../../server/app/agents/quiz_review.py)
- [server/app/services/quiz_service.py](../../server/app/services/quiz_service.py)

Purpose:

- check whether generated MCQ answer keys are actually correct
- drop invalid questions
- optionally regenerate replacement questions
- fail open if the reviewer output is unusable

This is a **LangGraph verify -> fix reflection loop**.

---

## 2. High-Level Architecture

```text
EduFX agent layer
  |
  +-- Deterministic planning
  |     SchedulingAgent
  |       -> uses RecommenderEngine output
  |       -> applies free-day/session-length caps
  |       -> updates streaks
  |
  +-- AI teacher
  |     dossier builder
  |       -> build grounded student snapshot
  |     teacher graph
  |       -> analyst
  |       -> diagnostician
  |       -> coach
  |       -> synthesis
  |       -> grounding guard
  |
  +-- Quiz self-check
        review graph
          -> verify generated MCQs
          -> regenerate if needed
          -> return safe final set
```

---

## 3. SchedulingAgent — The Planning Agent

### What it does

`SchedulingAgent` is the practical planning layer.

It does not decide topic importance from scratch.
Instead:

1. `RecommenderEngine` ranks subtopics
2. `SchedulingAgent` decides what is realistic for **today**

### Main methods

- `get_todays_plan(student_id)`
- `register_study_session(student_id)`
- `_resolve_cap(student, today)`
- `_select_capped(scored, cap)`

### Core idea

Separate these responsibilities:

1. **Prediction**:
   what seems important next?
2. **Product decision**:
   how much should the student actually see today?

EduFX keeps that split clean:

- `RecommenderEngine` -> ranking and model use
- `SchedulingAgent` -> availability, caps, weak/strong mix, streaks

### Request flow

```text
Frontend dashboard
  -> GET /scheduler/todays-plan/{student_id}
  -> routes/scheduler.py
  -> SchedulerController
  -> SchedulingAgent.get_todays_plan()
  -> RecommenderEngine.rank_candidates()
  -> SchedulingAgent caps/fills result
  -> StudyPlanItemDTO list returned
```

### Why this matters

This is why EduFX feels like a real learning product instead of a plain model
demo. The model can rank many things as useful, but the agent decides:

- is today even a study day?
- how many topics fit today's time budget?
- should we mix weak and strong items?

---

## 4. AI Teacher Graph — The Read-Only LangGraph Agent

### What it does

The AI teacher is used for:

- student chat about their own performance
- auto-generated progress reports

It is **read-only**:

- it does not change student data
- it does not change schedules
- it does not write new progress records

### The real flow

```text
/teacher/{student_id}/chat
or
/teacher/{student_id}/report

  -> TeacherController
  -> TeacherService
  -> build_student_dossier(...)
  -> dossier_to_prompt_context(...)
  -> teacher_graph.invoke(...)
  -> grounded teacher reply/report
```

### The specialist nodes

Inside
[server/app/agents/teacher_graph.py](../../server/app/agents/teacher_graph.py),
the graph can run three specialist roles:

- `analyst`
  - what the student has done
  - scores, activity, streak
- `diagnostician`
  - weak concepts
  - recurring mistakes
  - focus issues if visible
- `coach`
  - what to improve next
  - study advice
  - not scheduling advice

Then a synthesis node combines them into one final answer.

### Routing logic

- for `report` mode:
  all specialists run
- for `chat` mode:
  a lightweight router classifies which specialists are needed

That means the agent is more efficient for normal chat than for report
generation.

### Grounding guard

One of the best design details in this repo is the **grounding guard**.

The teacher graph may generate a reply that mentions a score or percentage that
was not actually present in the student's data.

So EduFX does this:

1. generate answer
2. detect invented percentages
3. ask for a correction pass
4. if invented figures still remain, strip those sentences

This makes the teacher safer and more credible for education use.

---

## 5. Student Dossier — The Data Foundation For The Teacher Agent

File:

- [server/app/agents/dossier.py](../../server/app/agents/dossier.py)

This file is extremely important because it is the bridge between raw backend
data and the teacher LLM.

### What it does

It builds a deterministic `StudentDossier` containing:

- student identity
- diagnostic state
- current streak / longest streak
- total sessions
- average quiz score
- average focus
- per-subtopic snapshot
- weak concepts
- behaviour summary

### Why it matters

The dossier means the teacher graph does **not** fetch or derive business logic
for itself.

Instead:

- repositories fetch data
- recommender engine supplies mastery estimates
- rules helpers compute weak concepts
- dossier packages everything into one grounded snapshot

That is a strong architecture choice because it keeps agent prompting separate
from domain computation.

---

## 6. Quiz Self-Check Graph — The Safety Agent

### What it does

This graph exists for one reason:

> Never send a student a question whose marked answer is actually wrong.

That is one of the worst possible education bugs.

So after MCQs are generated, EduFX can run them through
`review_quiz_questions(...)`.

### Flow

```text
QuizService generates questions
  -> quiz_review graph verify node
  -> examiner-style verdicts
  -> keep valid questions
  -> if shortfall and regenerate callback exists
       regenerate replacements
       verify again
  -> final reviewed question set
```

### Important design choice: fail open

If the reviewer:

- is unavailable
- returns invalid JSON
- returns something unusable

the system keeps the original questions instead of silently deleting
everything.

That means the reviewer acts like a **safety net**, not a hard blocker that can
destroy quiz availability.

### Why this is useful in a viva

This is a good engineering talking point:

> We added a reflection-style quality check to reduce answer-key hallucinations
> in generated MCQs, but we designed it to fail open so the app stays usable if
> the reviewer model has a bad response.

---

## 7. Where These Agents Enter The Product

### Scheduling agent

- dashboard daily plan
- post-quiz streak updates

### Teacher agent

- `/teacher/{student_id}/chat`
- `/teacher/{student_id}/report`

### Quiz review agent

- inside quiz generation flow
- before generated questions reach the student

So the agent layer affects:

- planning
- coaching
- reporting
- content quality

not just one screen.

---

## 8. Files To Study

If you want to learn the real agent layer through the code, read in this order.

### First: planning agent

1. [server/app/routes/scheduler.py](../../server/app/routes/scheduler.py)
2. [server/app/controllers/scheduler_controller.py](../../server/app/controllers/scheduler_controller.py)
3. [server/app/services/scheduling_agent.py](../../server/app/services/scheduling_agent.py)
4. [server/app/ml/recommender_engine.py](../../server/app/ml/recommender_engine.py)

### Then: LangGraph teacher agent

5. [server/app/routes/teacher.py](../../server/app/routes/teacher.py)
6. [server/app/controllers/teacher_controller.py](../../server/app/controllers/teacher_controller.py)
7. [server/app/services/teacher_service.py](../../server/app/services/teacher_service.py)
8. [server/app/agents/dossier.py](../../server/app/agents/dossier.py)
9. [server/app/agents/teacher_graph.py](../../server/app/agents/teacher_graph.py)
10. [server/app/agents/prompts.py](../../server/app/agents/prompts.py)

### Then: quiz safety agent

11. [server/app/services/quiz_service.py](../../server/app/services/quiz_service.py)
12. [server/app/agents/quiz_review.py](../../server/app/agents/quiz_review.py)

### Finally: dependency wiring and tests

13. [server/app/core/container.py](../../server/app/core/container.py)
14. [server/tests/unit/test_agents.py](../../server/tests/unit/test_agents.py)

---

## 9. What To Say In A Viva

Short version:

> EduFX has two kinds of agents. First, the deterministic SchedulingAgent turns
> recommender rankings into a realistic daily plan using availability and
> streak rules. Second, the LangGraph agent layer provides an AI teacher and a
> quiz self-check loop. The teacher graph is grounded in a deterministic
> student dossier and uses specialist nodes plus a grounding guard. The quiz
> review graph verifies generated MCQs and optionally regenerates invalid ones.
> This keeps scheduling deterministic while using LLM agents only where they
> add value: coaching and content safety.

---

## 10. One-Line Mental Model

Remember it like this:

> `SchedulingAgent` decides **when and how much** to study,
> the teacher graph explains **how the student is doing**,
> and the quiz review graph checks **whether generated questions are safe to
> trust**.
