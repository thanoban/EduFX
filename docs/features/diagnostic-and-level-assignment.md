# Diagnostic and Level Assignment

## Purpose

This feature measures the student’s starting knowledge across the S-block
curriculum and assigns a starting level for each subtopic.

EduFX uses three levels:

- beginner
- intermediate
- advanced

## Frontend files

- [diagnostic-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/diagnostic/diagnostic-screen.tsx)
- diagnostic results screen and related route pages

## Backend files

- [diagnostic.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/diagnostic.py)
- diagnostic controller and diagnostic service
- rules and repositories that store per-subtopic level assignments

## Main routes and endpoints

Frontend routes:

- `/diagnostic`
- `/diagnostic/results`

Backend endpoints:

- `GET /diagnostic/questions`
- `POST /diagnostic/submit`

## What happens

1. EduFX loads 40 diagnostic questions.
2. The UI shows one question at a time with a question map.
3. The student answers all questions.
4. The frontend submits all answers in one request.
5. The backend scores the diagnostic per subtopic.
6. EduFX stores assigned levels for the student.
7. The frontend refreshes the student profile.
8. The student can now enter the adaptive dashboard.

## Why it matters

The diagnostic is the unlock step for personalization.

Without diagnostic levels:

- the scheduler does not know which topics are weak
- the study notes cannot be chosen at the right level
- the first study plan cannot be built properly

## Main output

The main result is a set of level assignments per subtopic.

Those levels drive:

- scheduler priority
- content selection
- quiz difficulty spread
- progress tracking
