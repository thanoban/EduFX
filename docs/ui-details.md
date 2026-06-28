# EduFX Webpage UI Details

This document describes the current user interface of the EduFX client application based on the implemented Next.js pages and screen components in `client/src`.

## UI Style Overview

- Design style: clean academic dashboard with soft card surfaces, indigo brand accents, rounded panels, and light gradient backgrounds.
- Primary colors:
  - Background canvas: light blue-gray
  - Brand accent: indigo
  - Success: green
  - Warning: amber
  - Danger: red
- Typography:
  - Uses `Inter`
  - Large bold hero headings
  - Medium-weight section headings and labels
- Common visual patterns:
  - Rounded cards with thin borders and soft shadows
  - Pill badges for status and levels
  - Progress bars and focus bars
  - Responsive grid layouts that collapse to one column on smaller screens

## Shared Layout Patterns

### 1. AppShell pages

Used by the main in-app experience.

- Left sidebar contains:
  - EduFX brand mark and product name
  - Navigation links:
    - Dashboard
    - Progress
    - Behaviour Logs
    - Settings
  - "Focus-aware learning" insight card
  - Student identity block with initials, name, email, and reset session button
- Main content area contains:
  - Header with eyebrow label `EduFX workspace`
  - Page title and subtitle
  - Optional action button on the right
  - Main page content inside a large rounded white panel

### 2. AuthShell pages

Used by diagnostic-related pages.

- Split layout with two large panels
- Left hero panel contains:
  - EduFX brandline
  - Big headline
  - Supporting text
  - Progress or completion summary
- Right panel contains:
  - Main interaction area such as question flow or results list

### 3. PageState pages

Used for loading, error, and empty states.

- Centered state card
- Icon + title + message
- Covers situations such as:
  - data loading
  - failed API loads
  - missing content

## Route-by-Route UI Details

## `/`

- Behavior: immediately redirects to `/dashboard`
- No standalone visible homepage UI

## `/login`

- Behavior: immediately redirects to `/dashboard`
- No dedicated login form is currently shown

## `/dashboard`

Main overview page for the student.

- Layout: `AppShell`
- Header:
  - Title: `Dashboard`
  - Subtitle welcomes the student and mentions the adaptive plan
  - Primary action button:
    - `Start first topic` if a plan exists
    - `Open diagnostic` if no plan exists
- Top hero strip:
  - Section label: `Today's route`
  - Shows next recommended topic or `Diagnostic required`
  - Explains that scheduling is based on performance, deadlines, and reinforcement balance
  - Three metric boxes:
    - weak zones
    - advanced topics
    - focus trend
- Four stat cards:
  - Subtopics mastered
  - Average focus
  - Planned today
  - Sessions completed
- Lower two-column section:
  - `Today's study plan`
    - List of planned topics
    - Each item shows:
      - subtopic title
      - group name
      - last quiz percentage
      - lane type
      - progress/focus bar
      - level pill
      - optional `Deadline override` pill
      - `Study` button
    - Empty state includes a `Start diagnostic` button
  - `Level distribution`
    - List of subtopics with:
      - title
      - completed session count
      - compact score bar
      - level pill

## `/diagnostic`

Diagnostic assessment flow.

- Layout: `AuthShell`
- Left hero panel:
  - Pill: `Step 1`
  - Title: `Diagnostic assessment`
  - Copy explains 40 short checks are used to set starting levels
  - Three metrics:
    - answered
    - remaining
    - current
  - Progress bar
  - Answered counter text
- Right interaction panel:
  - Two-column diagnostic layout
  - Left side:
    - `Question map`
    - Current subtopic label
    - Completed count pill
    - 40-button navigator grid
    - Guidance notes about level assignment and completion requirement
  - Right side:
    - Active question card
    - Question number and question text
    - Answered/pending badge
    - Four option cards for A, B, C, D
    - Previous and Next buttons
    - `Submit diagnostic` button
- Interaction behavior:
  - Users can jump to any question using the navigator
  - Submit stays disabled until all questions are answered

## `/diagnostic/results`

Diagnostic completion summary page.

- Layout: `AuthShell`
- Left hero panel:
  - Success pill: `Diagnostic complete`
  - Title: `Your adaptive study map is ready.`
  - Copy explains that each subtopic has been assigned a level
- Right panel:
  - List of subtopic results
  - Each result row shows:
    - subtopic title
    - diagnostic score percent
    - assigned level pill
  - Bottom action button: `Start learning`

## `/progress`

Detailed learning progress page.

- Layout: `AppShell`
- Header:
  - Title: `Progress`
  - Subtitle explains level, score history, and study cadence
- Top stats row:
  - Advanced topics
  - Beginner topics
  - Total sessions
- Main content:
  - Section card: `Learning map`
  - Displays a wide data table with columns:
    - Subtopic
    - Level
    - Last score
    - Sessions
    - Recent trend
  - Each row includes:
    - subtopic name
    - compact progress bar
    - level pill
    - score and session counts

## `/behaviour-logs`

Focus and session behaviour history page.

- Layout: `AppShell`
- Header:
  - Title: `Behaviour logs`
  - Subtitle explains that focus records come from quiz session snapshots
- Main section:
  - Section card: `Recent sessions`
  - Each session item shows:
    - subtopic title
    - focus percentage
    - phone percentage
    - away percentage
    - tracking status pill:
      - `Tracked`
      - `Skipped`

## `/settings`

Account and session control page.

- Layout: `AppShell`
- Header:
  - Title: `Settings`
  - Subtitle: account profile and session controls
- Two cards:
  - `Profile`
    - student name
    - student email
    - note that Google sign-in is handled through Supabase
  - `Session controls`
    - explains reset behavior
    - button: `Reset local session`

## `/study/[id]`

Study content page for a subtopic.

- Layout: `AppShell`
- Header:
  - Title: current subtopic title
  - Subtitle indicates content level and group name
  - Right action button: `Finish reading`
- Two-column content layout:
  - `Study notes`
    - rendered markdown content for the selected subtopic
  - `Session checklist`
    - pill showing current level
    - learning target summary card
    - checklist items:
      - read full note
      - choose webcam tracking
      - repeat attempts use personalized generation
    - green success callout about focus summary and AI explanations
- The `Finish reading` button leads to webcam check before quiz start

## `/webcam-check`

Camera readiness and tracking choice page.

- Layout: `AppShell`
- Header:
  - Title: `Before you begin`
  - Subtitle references the current student and upcoming quiz run
  - Action button: `Start quiz now`
- Two-column layout:
  - `Camera preview`
    - live video preview if enabled and permission granted
    - fallback state if webcam is disabled
    - status pills:
      - camera ready / no live feed
      - tracking enabled / tracking skipped
    - readiness checklist:
      - single learner in frame
      - permission granted
      - privacy-safe local analysis
      - tracking optional
  - `What will be tracked`
    - eye openness and drowsiness
    - looking away and presence
    - phone, talking, and multi-person indicators
    - privacy callout saying only derived focus flags are stored
    - buttons:
      - `Skip tracking`
      - `Enable tracking`

## `/quiz/[id]`

Quiz-taking interface.

- Layout: `AppShell`
- Header:
  - Title: subtopic title
  - Subtitle shows:
    - first manual attempt or personalized repeat quiz
    - total question count
  - Right-side status pill:
    - `Webcam on`
    - `Webcam off`
- Two-column layout:
  - Left navigator panel:
    - `Quiz navigator`
    - progress percentage pill
    - progress bar
    - question number grid
    - metrics:
      - answered count
      - webcam enabled/skipped
      - difficulty lane
  - Right question panel:
    - current question number and text
    - difficulty status pill
    - four answer option cards
    - instruction callout
    - Previous and Next buttons
    - `Submit quiz` button
- Interaction behavior:
  - Users can answer in any order using the navigator
  - Quiz submission waits until every question is answered
  - Webcam tracking can run in the background if enabled

## `/results/[id]`

Post-quiz results and explanation page.

- Layout: `AppShell`
- Header:
  - Title: `Session complete`
  - Subtitle mentions score, focus outcome, and AI explanations
  - Action button: `Back to dashboard`
- Success hero strip:
  - Success pill: `Session review`
  - Headline varies:
    - `Strong session`
    - `Recovery session`
  - Summary copy about combining quiz performance, focus behavior, and review
  - Metric boxes:
    - quiz score
    - focus score
    - level outcome
- Four stat cards:
  - Quiz score
  - Focus score
  - Phone alerts
  - Away alerts
- Lower two-column section:
  - `Behaviour summary`
    - drowsy percentage
    - talking percentage
    - absent percentage
  - `Question review`
    - one card per question attempt
    - shows:
      - question text
      - correct / needs review pill
      - student's answer
      - correct answer
      - AI explanation for wrong answers

## Loading, Error, and Empty States

Several routes use a consistent state-card UI before content is ready.

- Dashboard:
  - loading dashboard plan and progress
  - error if dashboard data fails
- Diagnostic:
  - loading questions
  - error loading diagnostic
  - empty state if no diagnostic questions exist
- Progress:
  - loading learning map
  - error loading progress
- Behaviour logs:
  - loading recent session summaries
  - error loading logs
- Study page:
  - loading study notes
  - error loading content
  - empty state if no content is found
- Quiz page:
  - loading question set
  - error loading quiz
  - empty state if no quiz is found
- Results page:
  - loading result data and explanations
  - error loading results
  - empty state if no session exists

## Responsive Behavior

- Desktop:
  - Sidebar stays on the left
  - Main pages use 2, 3, or 4-column grids
- Tablet and small screens:
  - Shell grids collapse to one column
  - Sidebar becomes stacked rather than sticky
  - Hero sections and metric grids reduce to simpler layouts
  - Navigators reduce column counts for smaller screens

## Current UX Notes

- `/login` is not yet a real authentication UI because it redirects directly to the dashboard.
- The homepage also redirects immediately, so the product currently opens inside the main app flow.
- The diagnostic experience is the most "onboarding-like" flow and visually differs from the rest through the split hero layout.
- Webcam tracking is presented as optional and privacy-safe in the UI.
