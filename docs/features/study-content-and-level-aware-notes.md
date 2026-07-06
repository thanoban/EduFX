# Study Content and Level-Aware Notes

## Purpose

This feature delivers study notes that match the student’s current level before
they attempt a quiz.

EduFX does not show the same note to every student. It tries to align the note
to the current mastery state for that subtopic.

## Frontend files

- [study-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/study/study-screen.tsx)

## Backend files

- [content.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/content.py)
- content controller and content service
- repositories that store the note body and subtopic metadata

## Main routes and endpoints

Frontend route:

- `/study/[id]`

Backend endpoints:

- `GET /content/subtopics`
- `GET /content/{subtopic_id}/{student_id}`

## What happens

1. The student chooses a subtopic from the dashboard plan.
2. EduFX loads the note for that student and subtopic.
3. The content route returns:
   - note body
   - subtopic title
   - group name
   - level
4. The study screen renders the note using Markdown.
5. The student then continues to webcam choice and quiz.

## Why the level matters

The same chemistry topic can be explained differently for:

- beginner
- intermediate
- advanced

That means the content feature helps the quiz make sense:

- beginners get guided explanation
- advanced students get leaner reinforcement

## User-facing outcome

The study page is the bridge between planning and assessment:

- dashboard decides what to study
- study page helps the student learn it
- quiz checks whether learning actually happened
