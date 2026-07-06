# EduFX Behavioural Tracking Guide

This document explains how EduFX webcam-based behavioural tracking works, why
it exists, which files implement it, what data gets stored, how focus scores
are calculated, and what was recently improved to make the tracking more
accurate.

It is written as a project-learning guide, so you can use it for development,
debugging, and viva explanations.

## 1. Purpose

EduFX does not use webcam tracking as a punishment system.

It uses webcam tracking to add learning context around a quiz session:

- Was the student focused or frequently distracted?
- Did they leave the frame?
- Was a phone visible often?
- Did the session look drowsy or noisy?
- Should the recommender trust that quiz result as strong evidence of mastery?

This matters because EduFX is behaviour-aware:

- quiz correctness tells us what the student answered
- behavioural tracking tells us how reliable that attempt may have been

So behaviour tracking supports the recommender, progress interpretation, and
session review.

## 2. High-Level Flow

The end-to-end flow is:

1. Student opens the webcam check page.
2. Student chooses `Enable tracking` or `Skip tracking`.
3. Quiz page starts `useWebcamTracker()`.
4. The browser opens the camera and creates an offscreen video stream.
5. `BrowserBehaviourTracker` samples frames during the quiz.
6. `FaceTracker` analyzes facial state using MediaPipe.
7. `PhoneDetector` analyzes whether a phone is visible using TFLite.
8. `FrameQualityAnalyzer` checks whether the frame is dark, overexposed, or blurry.
9. A live focus state is shown on the quiz screen.
10. Snapshot logs are periodically sent to the backend.
11. When the quiz ends, EduFX saves a session summary.
12. The backend recomputes and stores the final behaviour percentages and focus score.

## 3. Main Frontend Files

### Webcam choice and entry

- [webcam-check-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/webcam-check-screen.tsx)
  Lets the student decide whether tracking is enabled before the quiz starts.

### Quiz integration

- [quiz-screen.tsx](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/quiz/quiz-screen.tsx)
  Starts and stops webcam tracking for the session and shows the live tracking
  state.

### Webcam hook

- [use-webcam-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/use-webcam-tracker.ts)
  Owns the browser camera stream, the offscreen `<video>`, snapshot timing, and
  final summary save.

### Live orchestrator

- [behaviour-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/behaviour-tracker.ts)
  Coordinates face tracking, phone detection, frame quality checks, smoothing,
  and live focus state updates.

### Face analysis

- [face-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/face-tracker.ts)
  Uses MediaPipe Face Landmarker to detect:
  - face present / absent
  - looking away
  - drowsiness
  - talking
  - multiple persons
  - calibration state

### Phone detection

- [phone-detector.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/phone-detector.ts)
  Uses TensorFlow.js + TFLite to classify whether a phone appears in the frame.

### Frame quality guard

- [frame-quality.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/frame-quality.ts)
  Detects low light, overexposure, and blur so EduFX can soften unreliable
  focus flags.

## 4. Main Backend Files

### Routes

- [behaviour.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/routes/behaviour.py)

Endpoints:

- `POST /behaviour/save-snapshot`
- `POST /behaviour/save-summary`
- `GET /behaviour/session/{session_id}`
- `GET /behaviour/student/{student_id}`

### Service

- [behaviour_service.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/services/behaviour_service.py)

The service is important because the backend is the source of truth:

- it recalculates snapshot focus scores
- it recomputes summary percentages from stored snapshots
- it does not trust client-sent summary numbers blindly

### Shared scoring rules

- [rules.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/core/rules.py)

This contains:

- `calculate_focus_score()`
- `aggregate_behaviour()`

### Shared contracts

- [index.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/shared/contracts/index.ts)

This defines:

- `BehaviourSnapshotPayload`
- `BehaviourSummaryPayload`
- `BehaviourSession`
- `BehaviourHistoryItem`

## 5. What the Frontend Detects

EduFX tracks these behaviour flags per snapshot:

- `face_detected`
- `looking_away`
- `phone_detected`
- `drowsy`
- `multiple_persons`
- `talking`
- `absent`
- `focus_score`

### What each one means

#### `face_detected`

Whether a valid face was detected in the current frame.

#### `absent`

True when the student has been missing from the frame long enough to count as
away. After the recent update, the timeout is shorter and more responsive:

- current absent timeout: about `4 seconds`

#### `looking_away`

True when the face orientation and position suggest the student is not looking
toward the screen.

#### `phone_detected`

True when the phone classifier sees a phone-like object in the frame.

#### `drowsy`

True when the eye and eyelid signals suggest sustained low-alertness, not just
a single blink.

#### `multiple_persons`

True when more than one face is visible.

#### `talking`

True when mouth movement signals suggest the student is talking during the quiz.

## 6. How Face Tracking Works

The face tracker uses MediaPipe landmarks plus derived ratios.

### Core landmark ratios

#### Eye aspect ratio (EAR)

Used to estimate eye openness.

Low EAR over multiple frames can indicate drowsiness.

#### Mouth aspect ratio (MAR)

Used to estimate how open the mouth is.

High MAR over multiple frames can indicate talking.

#### Yaw and pitch

Estimated from face geometry:

- yaw: horizontal head direction
- pitch: vertical head direction

These support `looking_away`.

### Additional signals added in the new version

The improved tracker also uses:

- `eyeClosure`
- `mouthOpen`
- `centerOffsetX`
- `centerOffsetY`

These make the system less dependent on one fragile signal.

## 7. Recent Accuracy Improvements

This is the most important update from the latest behavioural tracking work.

Previously, the tracker depended too much on fixed thresholds like:

- `ear < 0.23`
- `mar > 0.42`
- direct yaw/pitch threshold checks

That caused noisy behavior across different students, lighting conditions, and
camera positions.

The updated system now improves accuracy in five major ways.

### 7.1 Per-session calibration

EduFX now calibrates against the student’s normal face position and natural
resting state at the beginning of the session.

It builds a baseline for:

- EAR
- MAR
- yaw
- pitch
- eye closure
- mouth openness
- face center offset

This means the tracker compares the student against their own normal state,
instead of treating every face exactly the same.

### 7.2 Temporal smoothing

Frame-to-frame values are smoothed using moving updates before behaviour flags
are decided.

This reduces:

- one-frame spikes
- jitter
- false drowsy triggers
- false away triggers

### 7.3 Hysteresis and debounce

EduFX no longer flips behaviour flags on a single frame.

Flags such as:

- drowsy
- talking
- looking away
- multiple persons

now need repeated evidence before activating, and repeated clean evidence before
clearing.

This makes the tracker behave more like a real monitoring system and less like a
frame-by-frame alarm.

### 7.4 Frame quality gating

The new `FrameQualityAnalyzer` checks whether the camera frame is:

- too dark
- too bright
- too blurry

If the frame quality is poor, EduFX softens unreliable focus flags instead of
pretending they are trustworthy.

This is a major practical improvement because webcam errors are often caused by
bad image quality, not model weakness alone.

### 7.5 Smoothed phone detection

Phone detection now uses a stabilized signal instead of trusting one raw model
score at a time.

This reduces:

- brief false positives
- brief false negatives
- noisy phone toggling in the UI

## 8. Live Tracker State in the Quiz UI

The quiz page now exposes a better real-time state.

Important live fields include:

- `focusScore`
- `calibrated`
- `calibrationProgress`
- `quality`
- `warning`

### What the student sees

On the quiz page, the student can now see:

- `Calibrating X%` while baseline building is in progress
- `Focused` when clean conditions are detected
- warning pills such as:
  - `Away`
  - `Phone`
  - `Drowsy`
  - `Looking away`
  - `Multiple people`
  - `Talking`
  - `Quality check`

This makes the UI more honest and easier to understand.

## 9. Camera Input Settings

In [use-webcam-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/use-webcam-tracker.ts),
EduFX now asks the browser for a better input stream:

- facing mode: `user`
- ideal width: `1280`
- ideal height: `720`
- ideal frame rate: `24`
- max frame rate: `30`

This gives the tracker cleaner input than a default low-quality stream.

## 10. Focus Score Formula

Frontend and backend use the same penalty model.

The score starts at `100`.

Penalties:

- `phone_detected` -> `-40`
- `absent` -> `-50`
- `drowsy` -> `-30`
- `looking_away` -> `-20`
- `multiple_persons` -> `-20`
- `talking` -> `-10`

Final rule:

- `focus_score = max(0, score)`

This logic appears in:

- frontend live view:
  [behaviour-tracker.ts](D:/PROJECTS/2ndYearProject/EduFX_MVC/client/src/features/webcam/behaviour-tracker.ts)
- backend source of truth:
  [rules.py](D:/PROJECTS/2ndYearProject/EduFX_MVC/server/app/core/rules.py)

## 11. Snapshot and Summary Storage Model

EduFX stores behaviour in two layers.

### Layer 1: snapshots

Snapshots are frequent point-in-time behaviour records during the quiz.

They are sent through:

- `POST /behaviour/save-snapshot`

Payload shape:

```ts
type BehaviourSnapshotPayload = {
  student_id: number;
  session_id: number;
  face_detected: boolean;
  looking_away: boolean;
  phone_detected: boolean;
  drowsy: boolean;
  multiple_persons: boolean;
  talking: boolean;
  absent: boolean;
  focus_score: number;
};
```

Important note:

- the client sends a focus score
- the backend recomputes the real focus score
- the backend does not trust the client value blindly

### Layer 2: session summary

At the end of the quiz, EduFX stores a summary through:

- `POST /behaviour/save-summary`

Payload shape:

```ts
type BehaviourSummaryPayload = {
  student_id: number;
  session_id: number;
  subtopic_id: number;
  webcam_enabled: boolean;
  phone_percent: number;
  drowsy_percent: number;
  away_percent: number;
  talking_percent: number;
  absent_percent: number;
  focus_score: number;
};
```

Important note:

- if tracking is off, focus is stored as `null`
- if tracking is on but no snapshots exist, focus is still stored as `null`
- if snapshots exist, the backend recomputes summary percentages from the logs

## 12. How Summary Percentages Are Computed

The backend uses stored snapshots and calculates:

- `phone_percent`
- `drowsy_percent`
- `away_percent`
- `talking_percent`
- `absent_percent`

Example:

- 10 snapshots
- 4 have `phone_detected = true`

Then:

- `phone_percent = 40`

### Final summary focus score

The summary `focus_score` is not the average of raw numeric scores.

Instead, the backend counts how many snapshots are considered focused:

- focused snapshot = `focus_score >= 80`

Then it calculates the percentage of focused snapshots.

So if 6 out of 10 snapshots are focused:

- final summary `focus_score = 60`

## 13. API and Product Surfaces That Use This Data

Behaviour tracking is visible in multiple places.

### Quiz page

- live status pills
- live focus score
- calibration and quality messages

### Results page

- focus-related summary for the finished session

### Behaviour logs page

- history of tracked sessions

### Admin views

- average focus metrics
- student session review

### Recommender context

Behaviour data gives learning context to the adaptive system, especially when
interpreting whether a quiz result reflects true understanding or distracted
performance.

## 14. Privacy Model

Current UX messaging is privacy-aware:

- tracking is optional
- students can skip tracking
- the system stores behaviour signals and summary values, not raw webcam video

That matters for ethics, user trust, and viva discussion.

## 15. Current Strengths

The current behavioural tracker is now much better than the original version
because it has:

- real face landmark analysis
- real phone classification
- calibration
- smoothing
- hysteresis
- frame quality checks
- backend recomputation for trustworthiness
- optional participation

This is a solid browser-based behavioural tracking design for an academic
project.

## 16. Current Limitations

Even after the improvements, it still has limitations.

### Browser limitations

- all tracking is still running in the browser tab
- heavy inference can affect responsiveness on weak devices

### Camera limitations

- side angles can still reduce accuracy
- glasses, low light, and poor webcams can still reduce quality

### Behaviour interpretation limitations

- looking away does not always mean distraction
- talking may be false when reading aloud
- drowsiness is only an estimate, not a medical judgement

These are normal limitations and good to mention in a viva.

## 17. Best Next Technical Upgrades

If you want to push this system further, these are the best next upgrades.

### 17.1 Move inference work off the main UI thread

The browser tab currently handles UI plus webcam inference.

A stronger design would move tracking work into a worker-style pipeline so quiz
interaction stays smoother.

### 17.2 Add posture or upper-body cues

Right now, most behaviour inference is face-centric.

Adding body posture cues could improve:

- looking away detection
- absence confidence
- suspicious movement patterns

### 17.3 Add gaze-specific modelling

Current `looking_away` is based on face geometry and center offsets.

A more advanced gaze model could improve accuracy further.

### 17.4 Personal threshold tuning

The new calibration already helps, but a longer personalization window could
further improve:

- blink tolerance
- mouth movement tolerance
- natural resting head angle tolerance

### 17.5 Session analytics for evaluation

To evaluate tracking quality properly, create labeled test sessions such as:

- focused student
- student using phone
- student frequently looking away
- low light session
- blurry camera session

Then compare tracker outputs against expected labels.

That would turn behaviour tracking from a working feature into a measurable ML
subsystem.

## 18. Good Viva Explanation

If someone asks, “How does the behavioural tracking work?”, a strong answer is:

> EduFX runs optional browser-side webcam analysis during quizzes. The frontend
> uses MediaPipe face landmarks for face presence, away detection, drowsiness,
> talking, and multi-person checks, and a TensorFlow Lite model for phone
> detection. The latest version improves accuracy using per-session calibration,
> temporal smoothing, hysteresis, and frame-quality checks for blur and
> lighting. Snapshot logs are sent to the backend, which recomputes focus scores
> and aggregates final behaviour percentages per session. This behavioural
> signal is then used as context for interpreting quiz performance in the
> adaptive learning system.

## 19. Key Takeaway

The behavioural tracking system is not just “camera on/off”.

It is a full pipeline with:

- browser camera capture
- real-time inference
- signal stabilization
- API persistence
- backend recomputation
- session summary aggregation
- product UI integration
- adaptive-learning relevance

That makes it one of the important intelligent subsystems inside EduFX.
