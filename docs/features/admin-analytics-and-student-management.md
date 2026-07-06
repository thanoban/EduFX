# Admin Analytics and Student Management

## Purpose

This feature gives staff or project reviewers a higher-level view of student
activity across the system.

It supports:

- student list view
- student detail view
- role management
- weak concept review
- focus trend review

## Frontend files

- [admin-students-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/admin/admin-students-screen.tsx)
- [admin-student-detail-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/admin/admin-student-detail-screen.tsx)

## Backend files

- [admin.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/admin.py)
- admin controller and admin service

## Main routes and endpoints

Frontend routes:

- `/admin`
- `/admin/[studentId]`

Backend endpoints:

- `GET /admin/students`
- `GET /admin/students/{student_id}`
- `PATCH /admin/students/{student_id}/role`

## Security model

Admin endpoints are protected differently from ordinary student endpoints.

They require:

- a bearer token
- verified identity
- admin status check

So this feature is not only analytics, it is also an authorization feature.

## What the admin list shows

The list page summarizes:

- total students
- average mastered subtopics
- average focus score
- diagnostic completion
- session totals
- last active date

## What the student detail page shows

The detail page shows:

- role
- per-subtopic progress
- weak concepts
- session history
- focus score where available

It can also promote or demote student roles, except self-role changes.

## Why this feature matters

This gives EduFX an educator or reviewer-facing surface.

Without admin views, the project would only support the student side.

With admin analytics, the system can also support:

- supervision
- progress auditing
- concept weakness review
- role-based management
