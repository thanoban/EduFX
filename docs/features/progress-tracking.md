# Progress Tracking

## Purpose

This feature shows long-term student progress across all subtopics.

It answers:

- which topics are advanced?
- which topics are still beginner?
- how many sessions has the student completed?
- what is the recent score trend?

## Frontend files

- [progress-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/progress/progress-screen.tsx)

## Backend files

- [progress.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/progress.py)
- progress controller and progress service

## Main routes and endpoints

Frontend route:

- `/progress`

Backend endpoints:

- `GET /progress/{student_id}`
- `GET /progress/{student_id}/{subtopic_id}`

## What the page shows

The progress page summarizes:

- advanced topics count
- beginner topics count
- total session count
- per-subtopic level
- last score
- total attempts
- recent trend

## Why this feature matters

The dashboard is about today.

The progress page is about the student’s longer learning map.

This gives the student and the admin a broader view of:

- growth
- stuck areas
- consistency over time

## Key data source

The progress feature depends on accumulated session history, not just one quiz.

That makes it the historical memory surface of the learning system.
