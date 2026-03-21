# Truth Panel Redesign Spec

Replaces the keyword-score right panel with an evidence-based "Truth Panel," adds an Application Tracker page, and adds a Cover Letter slide-over. Phase 6 (check-in emails) is deferred.

## Scope

### In scope
- New `Application` and `ExperienceMatchCache` Prisma models
- Component extractions: nav bar, onboarding widget (move-only first commit)
- New components: Truth Panel, Cover Letter Panel
- New routes: Application Tracker page, experience match API, cover letter API, application CRUD APIs
- New AI functions: experience match (GPT-5-mini), cover letter generation (GPT-5.2)
- Server utilities for Application CRUD
- "Download & Track" button behavior
- Onboarding step updates
- Removal of old score system from builder

### Out of scope
- Phase 6: check-in emails, cron route, email templates (deferred — `nextCheckIn` field exists on model for future use)
- Left sidebar extraction
- Resume editor canvas, floating toolbar, AI Assistant modal
- Template customization, Tailor panel, PDF export
- Auth, payments, infrastructure
- Design system changes (use existing tokens)

## Data Model

### New: Application

```prisma
model Application {
  id              String   @id @default(cuid())
  userId          String
  resumeId        String
  jobId           String
  matchLevel      String   // "strong" | "moderate" | "weak" | "mismatch"
  matchSummary    String?
  status          String   @default("applied") // "applied" | "interviewing" | "offered" | "rejected" | "no_response"
  coverLetter     String?
  appliedAt       DateTime @default(now())
  statusUpdatedAt DateTime @default(now())
  nextCheckIn     DateTime? // Reserved for Phase 6
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user   User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  resume BuilderResume @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  job    Job           @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, status])
  @@index([nextCheckIn])
}
```

Reverse relations added to `User`, `BuilderResume`, `Job`.

### New: ExperienceMatchCache

```prisma
model ExperienceMatchCache {
  id         String   @id @default(cuid())
  resumeId   String
  jobId      String
  resumeHash String   // Hash of resume content for invalidation
  jobHash    String   // Hash of job content for invalidation
  resultJson String   // Serialized ExperienceMatch
  createdAt  DateTime @default(now())

  resume BuilderResume @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  job    Job           @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@unique([resumeId, jobId])
  @@index([resumeId])
}
```

**Cache hash definitions:**
- `resumeHash`: SHA-256 of JSON-serialized `{ about, experiences: [{ role, descriptions }], skills: [{ name }], education: [{ degree, school }] }` — the fields that affect match quality. Cosmetic fields (nameColor, font, layout) are excluded.
- `jobHash`: SHA-256 of `job.content` (the raw JD text).

### Modified: BuilderResume

Add field:
- `coverLetterDrafts String?` — JSON map keyed by jobId: `{ [jobId]: "cover letter text" }`. Supports multiple cover letters per resume (one per target job) without overwriting. Access via `JSON.parse(coverLetterDrafts)?.[selectedJob.id]`. On "Download & Track," extract the current job's draft and copy to `Application.coverLetter`.

### Modified: BuilderJob type

Add `company` to the `BuilderJob` type in `builder-resume.server.ts`:
```typescript
export type BuilderJob = {
  id?: string | null
  title?: string | null
  company?: string | null  // NEW — needed for Truth Panel, Cover Letter, toast
  content?: string | null
  extractedKeywords?: string | null
}
```
Update `getBuilderResume` query to select `company` from the Job relation.

## Component Architecture

### Extractions (first commit, move-only)

**`app/components/builder-nav.tsx`** — Extracted from builder index. Contains: logo, nav links (Resumes, Tracker), command palette trigger, save status, Customize button, dark/light toggle, Tailor button, Download & Track button, profile dropdown.

**`app/components/onboarding-widget.tsx`** — Extracted from builder index. Self-contained bottom-right fixed widget with step list and completion tracking.

Both extractions receive props from the builder parent for state and callbacks. No functional changes in the extraction commit.

### New Components

**`app/components/truth-panel.tsx`**

Props:
```typescript
interface TruthPanelProps {
  formData: ResumeData
  selectedJob: BuilderJob | null
  theme: Theme
  onGenerateCoverLetter: () => void
  onScrollToSection: (section: string) => void
}
```

**Type imports:** Use `import type` for `ResumeData`, `BuilderJob` from `builder-resume.server.ts` (same pattern as `ai-assistant-modal.tsx`).

Three stacked sections:

1. **Experience Match** — Label: "EXPERIENCE MATCH" (small uppercase tracking). Empty state when no job selected. When job selected: fetches match from `/resources/experience-match`, displays match level as large colored text + plain-language summary.
   - Colors: Strong = SUCCESS (#30A46C), Moderate = BRAND (#6B45FF), Weak = WARN (#F76B15), Mismatch = ERROR (#E5484D)
   - **Loading state:** Skeleton placeholder (pulsing `c.bgSurf` blocks) matching the layout of level + summary
   - **Error state:** "Couldn't analyze match" message with "Retry" button in BRAND color

2. **Best Moves** — Label: "BEST MOVES". Each move is a card with `c.bgSurf` background, `c.border` borders.
   - Cover letter card: "Generate with AI" button (BRAND bg, white text)
   - Gap/rewrite cards: amber/orange left border
   - Referral card: "Why is this?" link in BRAND color
   - "Don't apply" card: `ERROR + '08'` background, `ERROR + '20'` border

3. **Task Status** — Label: "TASK STATUS". Checklist with CheckCircle2 (SUCCESS) or empty Circle icons.
   - Resume tailored: edited since job selected
   - Cover letter written: `coverLetterDrafts` has an entry for the current job
   - Experience match reviewed: user has seen Truth Panel with job (session-only state in builder — `useState`, resets on refresh; not persisted, since it's low-stakes)
   - Employment gap addressed: only shown if gaps detected

**`app/components/cover-letter-panel.tsx`**

Slides in from right, overlaying Truth Panel. Same 390px width.

Props:
```typescript
interface CoverLetterPanelProps {
  open: boolean
  onClose: () => void
  formData: ResumeData
  selectedJob: BuilderJob | null
  theme: Theme
  onSave: (coverLetterText: string) => void
}
```

Contents:
- Header: "Back to Assessment" button, Regenerate/Copy/Download icons
- "Cover Letter" heading + "Tailored for [Job Title] at [Company]"
- Editable textarea with Crimson Pro font
- Auto-saves to `BuilderResume.coverLetterDrafts` (JSON map keyed by jobId) via the existing `/resources/save-resume` route on debounced changes. Requires adding `coverLetterDrafts` to the `updateBuilderResume` function's accepted fields.

## Routes

### `app/routes/tracker.tsx`

URL: `/tracker` (matches the nav label "Tracker").

Loader: requires auth, loads `getUserApplications(userId)` with resume and job relations.

Page: full-width, max-w-7xl, existing app layout. Table with columns: Company, Role, Match Level (badge), Date Applied, Status (inline dropdown), Actions (menu).

Actions menu:
- "View Resume" — navigates to `/builder` with that resume loaded via resume cookie
- "Delete" — POST to `/resources/applications` with `intent: "delete"`

Status update: POST to `/resources/applications` with `intent: "update-status"`.

Empty state: "No applications tracked yet." message + button linking to /builder.

### `app/routes/resources+/experience-match.ts`

POST handler:
1. Receives `{ resumeId: string, jobId: string }`
2. Loads resume and job from DB
3. Computes content hashes (see cache hash definitions above)
4. Checks `ExperienceMatchCache` — if hash match, return cached result
5. Calls `getExperienceMatch()` (GPT-5-mini, structured outputs)
6. Post-processes: ensures `cover_letter` present for moderate/strong, ensures `referral` always present
7. Stores in cache
8. Returns `ExperienceMatch`

### `app/routes/resources+/generate-cover-letter.ts`

POST handler:
1. Receives `{ resumeId: string, jobId: string }`
2. Loads resume and job from DB (server-side, consistent with experience-match)
3. Calls `generateCoverLetter()` (GPT-5.2, plain text)
4. Returns cover letter string
5. Counts against AI usage limits

### `app/routes/resources+/applications.ts`

Single route with intent-based dispatch (matches existing pattern in `experience-editor.tsx`, `skill-editor.tsx`):

- `intent: "create"` — creates Application record. Called by "Download & Track" after PDF generation. Extracts current job's text from `BuilderResume.coverLetterDrafts` JSON map and copies to `Application.coverLetter` if present. Sets `nextCheckIn` to 7 days (data only).
- `intent: "update-status"` — updates Application status and `statusUpdatedAt`. Clears `nextCheckIn` for terminal statuses (offered/rejected).
- `intent: "delete"` — deletes Application record.

## AI Functions

### `app/utils/ai/experience-match.server.ts`

`getExperienceMatch(resumeData: ResumeData, jobDescription: string)`

- Model: GPT-5-mini
- Output: OpenAI structured outputs (response_format with JSON schema)
- Returns `ExperienceMatch`:

```typescript
interface ExperienceMatch {
  level: "strong" | "moderate" | "weak" | "mismatch"
  summary: string
  requirementsCovered: number
  requirementsTotal: number
  bestMoves: BestMove[]
}

interface BestMove {
  id: string
  type: "cover_letter" | "address_gap" | "referral" | "rewrite_bullets" | "dont_apply" | "linkedin"
  headline: string
  explanation: string
  actionable: boolean
  evidenceNote?: string
}
```

Prompt rules:
- Compare actual experience against JD requirements, not keyword overlap
- Be honest — "mismatch" and "dont_apply" are valid
- Detect employment gaps from resume dates
- Evidence notes cite actual research
- Max 4 best moves

Post-processing (always applied, ~10 lines):
- If level is "strong" or "moderate" and no `cover_letter` in bestMoves → prepend default cover letter move
- If no `referral` in bestMoves → append default referral move
- If length > 4: keep `cover_letter` at index 0, keep `referral` at last position, trim AI-generated moves from the middle until length = 4

### `app/utils/ai/cover-letter.server.ts`

`generateCoverLetter(resumeData: ResumeData, jobDescription: string, jobTitle: string, company: string)`

- Model: GPT-5.2
- Output: plain text string
- Under 400 words, no cliches, matches seniority level

## Server Utilities

### `app/utils/application.server.ts`

- `createApplication(userId, resumeId, jobId, matchLevel, matchSummary, coverLetter?)` — creates record, sets `nextCheckIn` to 7 days from now
- `getUserApplications(userId)` — all applications with resume/job relations, ordered by `appliedAt` desc
- `updateApplicationStatus(applicationId, userId, status)` — updates status + `statusUpdatedAt`, clears `nextCheckIn` for terminal statuses
- `deleteApplication(applicationId, userId)` — deletes record (with userId check for authorization)
- `// TODO: Phase 6 — check-in emails (getApplicationsDueForCheckIn, email sending, cron endpoint with shared secret auth)`

## Builder Changes

### Nav bar (`builder-nav.tsx`)

- Remove: score toggle button (`<Target>` icon with score number)
- Change: "Download Resume" → "Download & Track"
- Add: "Tracker" link next to "Resumes" in top nav
- "Download & Track" behavior: generate PDF → create Application (if job selected) → show toast "Application tracked for [Job Title] at [Company]. We'll check in on [date]."

### Right panel

- Keep 390px container with `borderLeft`, `c.bgEl` background
- Replace all contents with `<TruthPanel>` component
- Cover letter panel overlays Truth Panel when open
- `scorePanel` state renamed to panel visibility (Truth Panel is always present when visible)

### Removals from builder index

- `ScoreArc` component
- `tiers` array, `getTier()`, `scoreMsg()` functions
- `showScoreDetail` state and slide-over
- `keywordPopover`, `skillsAddPopover` state and handlers
- `summaryFixModal` state
- `checklistClickRect` ref
- Score toggle button in nav
- Keyword chips sections (Must-Haves / Supporting)
- Section scores display
- Opportunities checklist
- `useResumeScore` hook usage (delete hook file in cleanup step — it becomes dead code)
- `parseTieredKeywords` import (dead after keyword chips removal)

### Onboarding widget (`onboarding-widget.tsx`)

The existing `useOnboardingFlow` hook manages a multi-stage state machine tied to `GettingStartedProgress`. Rather than rewriting it, adapt it:

- Map existing stages to new steps:
  1. Create a resume — same as existing `hasResume` check
  2. Add a target job — same as existing `hasSavedJob` check
  3. Review your match assessment — session-only `useState` in builder (set to `true` when Truth Panel renders with a job). Not persisted to `GettingStartedProgress` — it's low-stakes and resetting on refresh is fine.
  4. Take your first action — session-only `useState` (set to `true` when any Best Moves button is clicked). Same rationale.

The hook's spotlight/job-modal flow remains unchanged. Only the step labels and completion conditions for steps 3-4 change.

## Cover Letter Draft Flow

1. User clicks "Generate with AI" → POST `/resources/generate-cover-letter` with `{ resumeId, jobId }` → response populates cover letter panel
2. Cover letter panel auto-saves to `BuilderResume.coverLetterDrafts[jobId]` via existing `/resources/save-resume` route on debounce
3. User can edit, regenerate, close and reopen — draft persists across sessions
4. "Download & Track" extracts `coverLetterDrafts[jobId]` and copies to `Application.coverLetter`
5. Draft survives page refresh, browser close, coming back next day

## Implementation Sequence

1. Prisma schema + migration (Application, ExperienceMatchCache, BuilderResume.coverLetterDrafts, BuilderJob.company type fix)
2. Component extractions: nav bar + onboarding widget (move-only commit)
3. Server utilities (application.server.ts)
4. AI functions (experience-match, cover-letter) — test in isolation
5. Truth Panel component — replace score panel
6. Cover Letter panel — wire into Truth Panel
7. Download & Track — modify download button + create applications
8. Application Tracker page
9. Onboarding update
10. Cleanup — remove dead score code, delete `use-resume-score.ts`, remove `parseTieredKeywords` import

## Testing

- Truth Panel: no job (empty state), each match level, varying best moves count, loading state, error state
- Post-processing: verify cover_letter and referral are always present when expected; verify trim preserves mandatory moves
- Cover letter: generation, draft persistence across refresh, copy to Application on download
- Download & Track: creates Application, shows toast; verify behavior when no job selected (no application created)
- Tracker: empty state, various statuses, inline status updates, delete action
- Experience match cache: invalidates when resume/job content changes; cache hit on re-render
- Type safety: `BuilderJob.company` is populated in loader
- Existing tests pass: `npx vitest run`, `npx playwright test`
