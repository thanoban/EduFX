# Results and AI Explanations

## Purpose

This feature turns a finished quiz into actionable feedback.

It combines:

- quiz performance
- level movement
- focus summary
- wrong-answer review
- explanation generation
- next-free-day check-in

## Frontend files

- [results-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/results/results-screen.tsx)

## Backend files

- [results.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/results.py)
- [explanation.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/explanation.py)
- results service
- explanation service

## Main routes and endpoints

Frontend route:

- `/results/[id]`

Backend endpoints:

- `POST /results/submit-quiz`
- `GET /results/session/{session_id}/{student_id}`
- `GET /explanation/{session_id}/{student_id}`

## What happens

1. The student submits quiz answers.
2. EduFX scores the session.
3. The backend updates:
   - correct count
   - quiz score
   - current level
   - level change status
4. EduFX loads the finished session details.
5. EduFX also loads explanations for wrong answers.
6. The results page shows both performance and focus context.

## Why explanations matter

Scoring alone is not enough.

EduFX also explains:

- what was wrong
- what the correct answer was
- what concept needs review

That turns a quiz from grading into feedback.

## Why the next-free check-in matters

The results page also asks:

- when are you next free?

This helps the settings and scheduler path plan future study days more
intelligently.

So the results page is not only a summary page.

It is also a bridge into the next scheduling decision.
