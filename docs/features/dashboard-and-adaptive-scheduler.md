# Dashboard and Adaptive Scheduler

## Purpose

This feature gives the student a personalized study plan for the day instead of
a flat list of all topics.

The dashboard answers:

- what should I study next?
- which topics are weak?
- which topics are already strong and only need reinforcement?
- how much work should fit into today?

## Frontend files

- [dashboard-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/dashboard/dashboard-screen.tsx)

## Backend files

- [scheduler.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/scheduler.py)
- scheduling agent and scheduler service logic
- recommender engine and related ML integration

## Main routes and endpoints

Frontend route:

- `/dashboard`

Backend endpoint:

- `GET /scheduler/todays-plan/{student_id}`

## What the dashboard shows

The dashboard combines:

- next recommended topic
- weak topic count
- advanced topic count
- recent focus trend
- planned topics for today
- level distribution across subtopics

## Scheduling idea

EduFX does not just rank topics once.

It tries to build a realistic study plan by combining:

- weakness
- overdue pressure
- current level
- recent performance
- reinforcement balance
- availability and session length

The result is usually described as:

- `2 weak + 1 strong`

That means:

- weak topics get priority
- strong topics still appear for maintenance

## Why this feature matters

This is one of the most important adaptive features in EduFX.

It turns student data into a daily decision:

- not just “how am I doing?”
- but “what should I do today?”

That is the practical value of the scheduler and recommender path.
