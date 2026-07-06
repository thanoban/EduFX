# Authentication and Session Management

## Purpose

This feature controls how a student enters EduFX, how the app restores a
session, and how the system protects inactive sessions.

EduFX supports:

- Google sign-in
- email/password sign-in
- optional demo sign-in
- automatic sign-out after inactivity

## Frontend files

- [login-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/auth/login-screen.tsx)
- [auth-provider.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/auth/auth-provider.tsx)
- [use-auth-guard.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/auth/use-auth-guard.ts)
- [auth-callback-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/auth/auth-callback-screen.tsx)
- [supabase.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/lib/supabase.ts)
- [storage.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/lib/storage.ts)

## Backend files

- [auth.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/auth.py)
- auth controller and auth service from the backend container

## Main routes and endpoints

Frontend routes:

- `/login`
- `/auth/callback`

Backend endpoints:

- `POST /auth/google`
- `GET /auth/check`

## Flow

1. Student opens `/login`.
2. The login screen offers email, Google, or demo access.
3. Supabase handles browser authentication.
4. The frontend gets an access token or demo token.
5. EduFX sends that token to `POST /auth/google`.
6. The backend returns a `StudentProfile`.
7. The profile and token are cached in browser storage.
8. Route guards decide whether to send the student to:
   - `/diagnostic` if diagnostic is not complete
   - `/dashboard` if diagnostic is already complete

## Session safety

The auth provider also manages session safety:

- idle timeout: `30 minutes`
- sign-out clears:
  - cached student profile
  - auth token
  - last diagnostic cache
  - last session cache
  - last quiz result cache

If the student becomes inactive long enough, EduFX sends them back to:

- `/login?session=expired`

## Why this feature matters

This feature is the gateway to the whole system.

Without it:

- EduFX cannot know which student is active
- progress cannot be personalized
- admin protection cannot work
- the dashboard cannot load the correct study plan
