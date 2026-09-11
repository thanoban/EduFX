# EduFX Landing Page Plan

> The previous landing page was removed on 2026-09-11. This document is the
> content and design contract for the replacement. The root route currently
> redirects to `/login` until the new page is implemented.

## 1. Goal

Explain EduFX in one calm, credible first visit and move a student to the
workspace. The page should feel like an academic product, not a generic AI
marketing template.

The landing page must communicate one promise:

> EduFX uses evidence from a student's performance to recommend the next
> chemistry topic worth studying.

## 2. Audience

### Primary: student

Needs a quick answer to: "What should I study next, and why?"

### Secondary: supervisor or examiner

Needs to see that the system is a real adaptive-learning implementation with
traceable models, retrieval, authentication, and measured evaluation.

The page should serve both audiences without turning the hero into a technical
document. Technical proof belongs below the first action.

## 3. Content Hierarchy

### First viewport

1. EduFX wordmark and a compact sign-in action.
2. A direct headline about adaptive chemistry study.
3. One short sentence explaining performance -> recommendation.
4. Primary action: `Start a diagnostic` or `Open workspace`.
5. Secondary action: `See how it works`.
6. One real, legible product image showing the learning workspace or a chemistry
   study context. Do not use a decorative blur or a fake dashboard screenshot.

Recommended hero copy:

```text
Study chemistry with a next step that makes sense.

EduFX uses diagnostic answers, quiz history, and optional focus signals to guide
you to the next A-Level chemistry topic worth your time.

[Start a diagnostic] [See how it works]
```

### Section 2: the student loop

Show three connected steps with one sentence each:

1. `Place` - answer a 40-question diagnostic across ten S-block subtopics.
2. `Practice` - study level-aware notes and take a targeted quiz.
3. `Return` - use the updated evidence to receive the next recommendation.

The copy must make clear that the student is guided by the system; the student
does not choose arbitrary curriculum content from a large catalogue.

### Section 3: what powers the recommendation

Use a simple evidence-led layout, not four nested cards:

- DKT predicts next-skill performance from the answer sequence.
- BKT is the interpretable fallback.
- Availability sets the amount of work that fits today.
- Rules enforce prerequisites, cooldowns, and safe fallbacks.

Use the phrase `recommendation engine` for the combined system. Do not call BKT
or DKT an autonomous agent.

### Section 4: grounded support

Explain that chemistry notes are stored in Supabase and retrieved before an
explanation is generated. State the current production behavior accurately:

- Azure production uses Groq for text generation.
- Current Azure retrieval uses lexical ranking over stored Supabase chunks.
- Vector retrieval is optional when an embedding provider is configured.

Avoid claiming that Vertex AI or a fine-tuned model is active in the current
production deployment.

### Section 5: measured proof

Present only evidence with context:

| Proof point | Wording |
|---|---|
| DKT | `0.6822 synthetic held-out ROC-AUC` |
| BKT | `0.6569 synthetic held-out ROC-AUC` |
| Fine-tuning | `QLoRA pipeline completed on Colab Enterprise` |
| Assessment | `40 checks across 10 S-block subtopics` |

The word `synthetic` is required beside the DKT/BKT metric. Do not present these
values as classroom accuracy or a guarantee of learning gain.

### Final action

Close with a short invitation to enter the actual product:

```text
Start with what you know. Let the next topic follow from the evidence.

[Open the workspace]
```

## 4. Visual Direction

### Mood

Light, focused, precise, and quietly scientific. Use a warm white canvas,
deep ink text, restrained violet as the action color, and a small amount of
cool blue or mint for data states. Avoid a dark theme, purple gradients, neon
glows, floating blobs, and excessive glassmorphism.

### Image direction

Create or source one authentic bitmap image for the hero:

- an A-Level chemistry desk with visible glassware, notes, and a laptop showing
  a readable EduFX workspace;
- natural daylight and a clean academic setting;
- enough quiet space for text overlay without hiding the subject;
- no fake unreadable UI, no stock-photo watermark, and no dark blur.

Use additional images only when they reveal a real product state or a real
chemistry object. Do not create screenshot-like images with invented metrics.

### Layout

- Maximum content width: approximately 1180-1240px.
- Desktop hero: two balanced columns, text and image aligned to the same top
  and bottom rhythm.
- Sections use full-width bands with one constrained inner layout.
- Cards are reserved for repeated steps or evidence items; never place cards
  inside cards.
- Keep the next section slightly visible below the first viewport.
- Use stable aspect ratios for all image and product-preview regions.

## 5. Responsive Contract

### Mobile

- One-column flow with the headline first and image second.
- Navigation collapses to logo, sign-in, and one menu control.
- Buttons remain full-width or fit on separate lines.
- No horizontal scrolling, clipped text, or overlapping image labels.
- Hero image remains inspectable; do not crop out the chemistry subject.

### Desktop

- Text column must not exceed a readable measure.
- Hero image must remain the dominant product/context signal.
- Navigation, hero copy, actions, and proof row share the same left edge.

## 6. Interaction Contract

- `Start a diagnostic` goes to `/login` when signed out, then follows the
  existing auth callback to self-assessment or dashboard.
- `Open workspace` goes to `/login`, `/diagnostic/self-assessment`, or
  `/dashboard` according to the existing auth state.
- `See how it works` scrolls to the student-loop section.
- Navigation anchors scroll to real sections and have visible focus states.
- No fabricated forms, pricing, testimonials, or notification promises.

## 7. Implementation Stages

### Stage 1: content and image

- approve the copy above;
- create one authentic hero bitmap;
- define color, type, spacing, and image tokens;
- record image source/license in the repository.

### Stage 2: structure

- create a new `LandingPage` component from empty sections;
- implement the auth-aware primary action;
- use semantic headings, landmarks, and links;
- keep the root route public and preserve all protected app routes.

### Stage 3: responsive polish

- test 390px, 768px, 1280px, and 1440px widths;
- verify text wrapping, image crop, focus states, and keyboard navigation;
- remove unused legacy landing CSS after the new component is stable.

### Stage 4: verification

- run TypeScript, Vitest, and production build;
- capture real browser screenshots at desktop and mobile sizes;
- check that the hero image is nonblank and the primary links navigate;
- verify that signed-out and signed-in actions resolve to the correct routes;
- deploy through the normal Azure GitHub Actions workflow only after checks pass.

## 8. Acceptance Checklist

- [ ] Old marketing component is not imported anywhere.
- [ ] Root route renders the new page and does not expose protected data.
- [ ] Hero message is understandable without technical knowledge.
- [ ] Product/chemistry image is authentic and readable.
- [ ] Current Groq, lexical retrieval, DKT/BKT, and QLoRA claims are accurate.
- [ ] No daily-email-reminder or Vertex-production claim appears.
- [ ] Desktop and mobile layouts have no overlap or clipped text.
- [ ] Keyboard focus, reduced motion, alt text, and contrast are verified.
- [ ] All existing frontend tests and production build pass.
