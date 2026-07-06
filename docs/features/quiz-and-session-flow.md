# Quiz and Session Flow

## Purpose

This feature runs the actual assessment session for a subtopic.

It combines:

- study-to-quiz transition
- session creation
- question display
- answer collection
- optional webcam tracking

## Frontend files

- [webcam-check-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/webcam-check-screen.tsx)
- [quiz-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/quiz/quiz-screen.tsx)
- [use-webcam-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/use-webcam-tracker.ts)

## Backend files

- [quiz.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/quiz.py)
- quiz controller and quiz service
- results service, because submission closes the session

## Main routes and endpoints

Frontend routes:

- `/webcam-check`
- `/quiz/[id]`

Backend endpoints:

- `GET /quiz/{subtopic_id}/{student_id}`
- `POST /quiz/generate`

## Session idea

EduFX treats a quiz as a study session record.

That session later connects to:

- quiz score
- behaviour summary
- explanations
- progress update
- scheduler context

## Question generation modes

The quiz flow supports two modes:

### First attempt

- uses the manual question bank

### Repeat or personalized attempt

- can use generated or personalized quiz generation

This lets EduFX avoid giving the exact same session every time.

## What the UI does

The quiz screen handles:

- current question
- answer map
- completion percentage
- webcam tracking state
- final submission

The student must answer all questions before submission is enabled.

## Why this feature matters

This is where learning evidence is created.

Without the quiz flow, the system would have:

- a plan
- content
- no real performance signal

So this feature is the measurement layer of EduFX.
