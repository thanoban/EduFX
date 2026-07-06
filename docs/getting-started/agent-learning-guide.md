# EduFX Agent Learning Guide

This document is only about the EduFX agent layer.

In this project, "agent" means the backend scheduling logic that turns model
predictions into a daily study plan. It is not an autonomous multi-agent system
and it is not the fine-tuned LLM.

The current agent class is:

- [server/app/services/scheduling_agent.py](../server/app/services/scheduling_agent.py)

## The First Basic Idea

Separate these two responsibilities:

1. Prediction:
   what topic seems important next?
2. Product decision:
   how many topics should we actually show today?

EduFX keeps those responsibilities separate:

- `RecommenderEngine` predicts topic priority
- `SchedulingAgent` applies real app rules and returns today's plan

That separation is the main design idea.

## Agent Folder Structure

The agent is not in one folder only. It spans a few backend layers:

```text
server/app/
  routes/scheduler.py
  controllers/scheduler_controller.py
  services/scheduling_agent.py
  ml/recommender_engine.py
  ml/recommender.py
  repositories/
    scheduler_repository.py
    progress_repository.py
    results_repository.py
    supabase_scheduler_repository.py
    supabase_progress_repository.py
    supabase_results_repository.py
  core/container.py
  core/rules.py
```

## Exact Request Flow

When the frontend asks for today's plan, the path is:

```text
Frontend dashboard
  -> GET /scheduler/todays-plan/{student_id}
  -> routes/scheduler.py
  -> SchedulerController
  -> SchedulingAgent.get_todays_plan()
  -> RecommenderEngine.rank_candidates()
  -> return ranked list
  -> SchedulingAgent caps and formats list
  -> JSON response to frontend
```

Files involved:

- Route:
  [server/app/routes/scheduler.py](../server/app/routes/scheduler.py)
- Controller:
  [server/app/controllers/scheduler_controller.py](../server/app/controllers/scheduler_controller.py)
- Agent:
  [server/app/services/scheduling_agent.py](../server/app/services/scheduling_agent.py)

## What Each File Does

### `routes/scheduler.py`

Purpose:

- expose the HTTP endpoint
- receive `student_id`
- pass control into the container/controller layer

It should stay thin. It should not contain agent logic.

### `controllers/scheduler_controller.py`

Purpose:

- call the agent service
- wrap the result in the standard response format

This file is intentionally tiny because the controller should coordinate, not
decide.

### `services/scheduling_agent.py`

Purpose:

- get today's plan
- decide whether today should have a plan at all
- decide how many items to show
- mix weak and strong topics
- update streak after study session completion

Main methods:

- `get_todays_plan(student_id)`
- `register_study_session(student_id)`
- `_resolve_cap(student, today)`
- `_select_capped(scored, cap)`

### `ml/recommender_engine.py`

Purpose:

- rank every subtopic for a student
- choose model path or fallback path

Main logic:

- load student progress
- load subtopics
- try DKT/BKT model scoring
- if not possible, use rules
- return a full ranked list

Important idea:

This file does not care about free days or session length. It is intentionally
availability-agnostic.

### `ml/recommender.py`

Purpose:

- convert stored quiz history into model-ready interaction sequences
- blend model mastery with level-based proxy
- compute scoring features such as:
  weak topic pressure, due-ness, ZPD fit, prerequisite penalty

This is the bridge between raw student data and ranking policy.

### `core/rules.py`

Purpose:

- shared deterministic scheduling rules
- cooldown checks
- due calculations
- level progression rules
- weak-concept extraction

This file is where the "product policy" constants live.

### `repositories/*`

Purpose:

- fetch data for the agent from either memory or Supabase

Important split:

- `memory` repositories:
  local/demo backend
- `supabase_*` repositories:
  live backend

This lets the same agent logic run on two storage backends.

### `core/container.py`

Purpose:

- dependency wiring

This is where the agent is actually constructed:

```text
RecommenderEngine(...)
SchedulingAgent(...)
SchedulerController(...)
ResultsService(..., scheduling_agent)
```

That means the same agent is used both for:

- planning
- post-quiz streak updates

## Data Flow Inside the Agent

### Input data

The agent itself does not train models and does not create embeddings.

It consumes data already stored by the rest of the app:

- `students`
  availability, free days, streak data
- `student_progress`
  level, last score, sessions count
- `session_summary`
  previous study sessions
- `quiz_attempts`
  correct/wrong history

### Transformation steps

```text
student_progress + session_summary + quiz_attempts
  -> interaction history
  -> DKT/BKT prediction
  -> topic score per subtopic
  -> weak/strong bucket
  -> cap by availability
  -> StudyPlanItemDTO list
```

### Output

The final output is a list of `StudyPlanItemDTO` objects with fields such as:

- `subtopic_id`
- `subtopic_title`
- `group_name`
- `current_level`
- `is_overdue`
- `last_quiz_score`
- `last_studied_date`
- `type`

So the frontend receives ready-to-render plan items, not raw model numbers.

## Model Path vs Rule Path

The agent can work in three modes.

### Mode 1: DKT

If `dkt.npz` exists and the student has enough history:

- DKT is loaded
- history is scored
- predicted `P(correct)` per skill is produced

This is the preferred path.

### Mode 2: BKT

If DKT is not available but `bkt.json` exists:

- BKT is loaded
- per-skill mastery and `P(correct)` are computed

This is the interpretable fallback.

### Mode 3: Rules only

If no model is available, or the student has too little history:

- the engine uses deterministic priority rules only

This is how cold-start students still get a useful plan.

## Why the Agent Uses History

The model input history is built from quiz sessions and attempts.

Each interaction includes:

- skill / subtopic
- correct or wrong
- focus
- tracked flag

That means the recommender is not purely score-based. It is
behaviour-aware.

Example:

- a correct answer with low focus should count less strongly than a correct
  answer with high focus

That idea enters the system in:

- [server/app/ml/recommender.py](../server/app/ml/recommender.py)
- [server/app/ml/dkt.py](../server/app/ml/dkt.py)
- [server/app/ml/bkt.py](../server/app/ml/bkt.py)

## Agent Integration With Quiz Results

The agent is not only called by the scheduler route.

After a quiz is submitted:

1. `ResultsService` stores the attempts
2. progress is updated
3. level may change
4. session summary is saved
5. `SchedulingAgent.register_study_session()` is called

File:

- [server/app/services/results_service.py](../server/app/services/results_service.py)

This is important because it means the agent owns cadence data such as:

- `current_streak`
- `longest_streak`
- `last_study_date`

So the agent affects both planning and engagement tracking.

## Availability Logic

One of the most important agent features is that it does not blindly return the
top-ranked topics.

It checks:

- does the student have free days configured?
- is today one of those days?
- did the student explicitly promise to study today?
- how long is their usual session?

Then it converts session length into a cap.

That is why the agent feels like a product feature, not just a model wrapper.

## Weak and Strong Mix

The recommender returns a full ranked list.

The agent then tries to create a balanced plan:

- more weak topics
- some stronger maintenance topics

If one bucket is too small, it fills from the top-ranked remaining topics.

This logic is in `_select_capped(...)`.

## Performance Lesson From This Project

A useful engineering lesson from this repo:

The slow part was not the DKT math.

The slow part was database access.

Originally the live route loaded quiz attempts one session at a time. That made
Supabase planning slow for students with many sessions.

The fix was:

- bulk-load attempts for many session IDs in one query

That change reduced scheduler-route latency significantly while keeping the same
agent behaviour.

So a good viva point is:

> The recommender math was already fast. The real optimization work was in the
> repository layer, especially reducing repeated Supabase round trips.

## How To Learn This Agent Step By Step

Use this order:

1. Read [server/app/routes/scheduler.py](../server/app/routes/scheduler.py)
2. Read [server/app/controllers/scheduler_controller.py](../server/app/controllers/scheduler_controller.py)
3. Read [server/app/services/scheduling_agent.py](../server/app/services/scheduling_agent.py)
4. Read [server/app/ml/recommender_engine.py](../server/app/ml/recommender_engine.py)
5. Read [server/app/ml/recommender.py](../server/app/ml/recommender.py)
6. Read [server/app/core/container.py](../server/app/core/container.py)
7. Read [server/app/services/results_service.py](../server/app/services/results_service.py)

When reading, ask:

- where does the data come from?
- where is the ranking decided?
- where is the daily cap decided?
- where does the DTO get created?

If you answer those four questions, you understand the agent structure.

## Short Viva Version

> The EduFX agent is the SchedulingAgent in the service layer. It does not
> directly train or host AI models. Instead, it asks the RecommenderEngine to
> rank subtopics using DKT first, BKT second, and deterministic rules as a
> fallback. Then it applies student availability, session-length caps, and a
> weak/strong topic mix to generate today's study plan. The same agent also
> updates streak data after a quiz is submitted through ResultsService.
