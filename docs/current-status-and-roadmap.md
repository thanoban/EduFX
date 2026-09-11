# EduFX Current Status and Roadmap

> Authoritative project status as of 2026-09-11. When another document
> conflicts with this page, use this page and the current source code.

## Production Release

| Item | Current value |
|---|---|
| Production commit | `b3905a07089f4b0546755ad09fff5c1e10c047db` |
| Frontend | `https://edufx-frontend.victorioussand-12db2490.centralindia.azurecontainerapps.io` |
| Backend | `https://edufx-backend.victorioussand-12db2490.centralindia.azurecontainerapps.io` |
| API documentation | `https://edufx-backend.victorioussand-12db2490.centralindia.azurecontainerapps.io/docs` |
| Hosting | Azure Container Apps, Central India |
| Images | Azure Container Registry |
| Database and auth | Supabase PostgreSQL and Supabase Auth |
| Text generation | Groq, configured by `AI_PROVIDER_ORDER=groq` |
| Retrieval | Supabase content chunks with lexical ranking in current Azure production |
| Automatic deployment | Push to `main` through `.github/workflows/deploy-azure.yml` |
| Legacy deployment | GCP Cloud Run workflow is manual-only |

Both Container Apps use `min-replicas=0` and `max-replicas=3`. This reduces
idle cost but means the first request after inactivity can be slower.

## Verified Production Contract

The deployment and independent checks for commit `b3905a0` verified:

| Check | Expected and observed result |
|---|---|
| Frontend `/` | `200` |
| Frontend `/diagnostic/availability` | `200` |
| Backend `/` | `200` |
| Backend `/health/providers` | `200` |
| Anonymous `GET /diagnostic/questions` | `401` |
| Removed `POST /internal/reminders/run` | `404` |
| Reminder route in OpenAPI | absent |
| Text provider order | `groq` |
| Embedding provider | `lexical` |

`401` for an anonymous diagnostic request is correct. Production students must
send their Supabase access token. A valid authenticated request can receive the
questions; a request without a token cannot download assessment content.

The GitHub Actions deployment and both CI jobs completed successfully. The
latest local verification also passed 125 backend tests, 18 frontend tests,
TypeScript checking, and the Next.js production build.

## Working Product Flow

```text
Landing page
  -> Supabase sign-in
  -> self-assessment
  -> 40-question diagnostic
  -> diagnostic results
  -> availability setup
  -> adaptive dashboard
  -> recommended study content
  -> optional webcam check
  -> quiz
  -> results and grounded explanations
  -> progress and behaviour history
  -> recalculated daily plan
```

The student does not browse the curriculum freely. The recommender ranks the
next useful subtopics and the scheduler exposes the active recommendation based
on mastery, spacing, prerequisites, and configured study time.

## System Components

### Authentication and authorization

- Supabase performs Google OAuth and email/password authentication.
- The browser sends the Supabase access token to the FastAPI backend.
- Supabase-backed production routes reject missing or invalid tokens.
- Student-scoped routes compare the token identity with the requested student.
- Admin routes require a student record with the `admin` role.
- The in-memory backend permits token-free calls for isolated local tests.

### Adaptive recommendation

- DKT is loaded first when `server/app/ml/artifacts/dkt.npz` exists.
- BKT is the model fallback when DKT cannot be loaded.
- Deterministic deadline and cooldown rules are the final fallback.
- The DKT artifact uses 10 skills, a 22-value input, and a 64-unit hidden state.
- The recorded held-out synthetic-data DKT ROC-AUC is `0.6822`.
- The scheduler applies daily availability and session-length caps after the
  recommender ranks candidates.

The DKT metric demonstrates predictive signal on simulated students. It is not
evidence of accuracy on a real student population. Real interaction data and a
prospective evaluation are required before making stronger claims.

### AI and retrieval

- Groq handles current production text generation for quizzes, explanations,
  teacher responses, and agent text calls.
- The QLoRA adapter is trained and stored as an artifact, but the current
  production health response reports no configured fine-tuned serving endpoint.
- The retriever reads chemistry chunks from Supabase.
- Without Vertex or a Gemini API key, retrieval uses lexical overlap rather
  than generating a new query embedding.
- Route-specific deterministic fallbacks keep supported flows available when
  a text provider fails.

### Behaviour tracking

- Camera processing runs in the browser.
- Face, object, frame-quality, audio, and integrity signals are summarized.
- Session summaries, not raw video, are sent to the backend.
- Webcam tracking is optional and cannot block studying or quiz submission.

### Agents

- `SchedulingAgent` turns ranked topics into a realistic daily plan.
- The teacher graph builds a deterministic student dossier before generating
  coaching text.
- The quiz-review graph checks generated quiz quality and can request another
  generation attempt.
- Agents orchestrate existing services and models; they do not replace BKT,
  DKT, retrieval, or authorization.

## Deliberately Disabled or Optional Features

### Daily email reminders

Daily email reminders are removed from the UI, API, and GitHub Actions. The
previous workflow could not provide a reliable production feature without a
verified mail provider, consent handling, unsubscribe support, and delivery
monitoring. Availability remains active and continues to control scheduling.

Reintroduce reminders only after those requirements are implemented and tested.

### Fine-tuned model serving

QLoRA training completed successfully, but serving is optional. Quiz generation
uses the fine-tuned endpoint first only when `FINETUNED_MODEL_URL` is configured.
Current Azure production falls through directly to Groq.

### GCP and Vertex

GCP deployment and Vertex support remain in the repository for manual recovery
and historical learning. They are disabled in the Azure production workflow and
must not be described as the active production path.

## Known Risks and Limitations

1. Demo tokens are still recognized by backend token parsing. Before external
   production use, reject `demo:` tokens whenever `ENVIRONMENT=production`.
2. CORS currently accepts all HTTPS `*.run.app` and
   `*.azurecontainerapps.io` origins. Restrict it to the exact production and
   approved preview origins.
3. CI tests use the in-memory backend. A separate authenticated staging suite is
   needed to validate Supabase policies and deployed ownership checks.
4. Scale-to-zero can cause cold-start latency during the first request.
5. Lexical retrieval is robust and inexpensive but weaker than evaluated
   hybrid or embedding retrieval for paraphrased questions.
6. DKT was evaluated on synthetic data. Its `0.6822` ROC-AUC must not be called
   real-world student accuracy.
7. The six-record QLoRA dataset proves the training pipeline, not broad syllabus
   generalization.
8. Behaviour signals are environmental indicators, not medical, identity, or
   cheating determinations.

## Delivery Plan

### Phase 0: production security

- Disable demo-token authentication in production.
- Replace broad cloud-host CORS regexes with an explicit allowlist.
- Add deployed tests for missing token `401`, cross-student `403`, admin `403`,
  and valid Supabase token success.
- Confirm secrets exist only in GitHub Environment secrets and Azure Container
  App secret references; rotate any value exposed outside those stores.

### Phase 1: reliability and observability

- Add structured request IDs and provider latency/error metrics.
- Track Azure cold starts and decide whether a minimum backend replica is worth
  the additional cost before demonstrations.
- Add bounded retry/circuit-breaker behavior around Groq and Supabase calls.
- Add a staging environment so destructive QA never writes production data.

### Phase 2: retrieval and AI quality

- Build a labelled retrieval evaluation set from real S-block questions.
- Compare lexical, BM25, embedding, and hybrid ranking using recall at k.
- Add schema-constrained quiz generation and record review-agent rejection rate.
- Expand the QLoRA dataset to at least 50-100 reviewed examples, run held-out
  quality tests, and only then decide whether GPU serving is justified.

### Phase 3: recommender validation

- Collect consented, de-identified interaction sequences.
- Compare DKT, BKT, and deterministic ranking on the same temporal split.
- Measure ROC-AUC, calibration, coverage, repeated-topic rate, and learning gain.
- Keep BKT and deterministic rules as explainable fallbacks.

### Phase 4: product completeness

- Run mobile, keyboard, screen-reader, and slow-network journeys.
- Add positive admin integration tests and complete settings/teacher API tests.
- Reconsider email or calendar notifications only with explicit opt-in, provider
  monitoring, unsubscribe controls, and privacy documentation.

## Release Rules

A production change is complete only when:

1. backend tests, frontend tests, and TypeScript checking pass;
2. the production frontend build passes;
3. the Azure deployment workflow succeeds for the intended commit;
4. public health routes return `200`;
5. protected anonymous routes return `401`;
6. authenticated ownership tests return `200` for the owner and `403` for a
   different student;
7. no retired endpoint is present in OpenAPI;
8. live provider health matches the intended production provider configuration.
