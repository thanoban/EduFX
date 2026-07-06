# Settings and Availability

## Purpose

This feature lets the student shape how EduFX plans study time.

It controls:

- weekly free days
- session length per day
- email reminder preference
- sign-out and account session controls

## Frontend files

- [settings-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/settings/settings-screen.tsx)

## Backend files

- [settings.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/settings.py)
- settings controller and settings service

## Main routes and endpoints

Frontend route:

- `/settings`

Backend endpoints:

- `PUT /settings/{student_id}/availability`
- `POST /settings/{student_id}/next-free`

## What the page does

The settings page allows the student to choose:

- which days they are free
- how much time they usually have on each free day
- whether email reminders should be enabled

It also gives:

- current profile details
- logout control
- session timeout explanation

## Why per-day availability matters

Not every day has the same amount of study time.

EduFX now supports:

- a different session length per day

That means:

- a busy weekday can stay short
- a weekend can be longer
- the scheduler can size the daily plan more realistically

## Why this feature matters

This is how the student teaches EduFX about real life constraints.

Without this feature, the scheduler would know:

- what is weak

but not:

- how much work realistically fits today
