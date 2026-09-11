# Code Quality Standard

EduFX should read like a final-year engineering project maintained by a small
senior team: clear boundaries, small functions, and no clever code unless it
removes real complexity.

## Principles

- Keep route handlers thin. They should validate HTTP input, apply auth
  dependencies, and delegate to controllers or services.
- Keep business rules in services, agents, or ML modules, not in React pages or
  FastAPI routes.
- Keep data access behind repository contracts so `memory` and `supabase`
  implementations stay interchangeable.
- Prefer one shared helper over repeated call-site fixes. For example, the
  frontend API client owns bearer-token attachment instead of every screen
  passing tokens manually.
- Treat browser-provided IDs as hints, not authority. The backend must verify
  the bearer token and check student ownership before returning student data.
- Keep generated exports, screenshots, IDE files, logs, and test artifacts out
  of normal Git status.
- Add focused tests for small production contracts that are easy to break, such
  as auth-token forwarding and OAuth callback recovery.

## Frontend Expectations

- Pages should compose feature screens and loading states; feature folders own
  interaction logic.
- Shared API behavior belongs in `client/src/lib/api.ts`.
- Shared browser persistence belongs in `client/src/lib/storage.ts`.
- Loading screens should be calm and useful, with short copy and no blocking
  layout shifts.
- Teacher responses should render as structured UI, not raw Markdown.

## Backend Expectations

- Routes in `server/app/routes/` should stay declarative.
- Controllers should adapt request data to service calls.
- Services should contain product behavior and call repositories.
- Repositories should be the only layer that knows storage details.
- Auth and ownership checks should be applied before service logic reads or
  writes student-owned data.

## Review Checklist

- Can a new reader find the feature entry point in under one minute?
- Is the same logic duplicated in more than one place?
- Does every protected student route verify the token and student ownership?
- Does the frontend send the bearer token without each screen manually passing
  it?
- Are generated files ignored or kept under a deliberate artifact folder?
- Do tests cover the behavior most likely to break in production?
