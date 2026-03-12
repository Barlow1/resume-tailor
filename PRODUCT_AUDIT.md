# Product Audit: Resume Tailoring Gap Analysis

**Date:** 2026-03-09
**Complaint:** "I signed up expecting the tool to automatically rewrite my resume content to match the job description. It only flags issues without making changes."

---

## 1. Current Flow Diagram

### Primary Path: Builder (`/builder`)

```
User uploads resume (PDF/DOCX)
       |
       v
OpenAI parses resume into structured JSON  (openai-resume-parser.server.ts)
       |
       v
Resume populates the Builder form  (BuilderResume model, editable in-browser)
       |
       v
User pastes a job description  (Job model, stored as raw text)
       |
       v
AI extracts keywords from JD  (keyword-extraction.server.ts, async background call)
       |
       v
Client-side scoring engine runs  (resume-scoring.ts, lines 567-594)
  - Keyword match score (50% weight)
  - Metrics score (20%)
  - Action verbs score (20%)
  - Length score (10%)
       |
       v
Improvement Checklist displayed  (resume-scoring.ts generateChecklist(), lines 599-1066)
  - "Must-have keywords missing: X, Y, Z"
  - "Add a number to 3 more bullets"
  - "Lead with a strong verb on 2 more bullets"
  - Each item has a fixType pointing to a specific action
       |
       v
*** USER MUST MANUALLY ACT ON EACH ITEM ***
       |
       v
For bullets: user clicks a bullet -> opens AI Assistant Modal -> clicks "Tailor Achievement"
       |
       v
AI returns 3 rewrite options for THAT ONE BULLET  (openai.server.ts getBuilderExperienceResponse, lines 307-447)
       |
       v
User reviews, optionally edits, and clicks "Accept" on one option
       |
       v
Single bullet updated in the builder form
       |
       v
User repeats for every bullet they want rewritten (one at a time)
```

### Secondary Path: Analyze (`/analyze`)

```
User uploads resume + pastes JD (no account required)
       |
       v
AI generates fit percentage, strengths, weaknesses, keyword plan
       |
       v
Results page shows analysis with "keyword plan" and "improve bullets" suggestions
       |
       v
*** NO WAY TO APPLY CHANGES FROM HERE ***
User must manually go to /builder and recreate the resume to act on suggestions
```

### Dead Code Path: Full Resume Tailor (exists but disconnected)

```
getEntireTailoredResumeResponse()  (openai.server.ts lines 213-305)
       |
       v
API endpoint exists in builder-completions.ts (lines 69-205, entireResume === 'true')
       |
       v
*** NO UI BUTTON TRIGGERS THIS ***
TailorFlowStepper component exists but is NOT imported anywhere
TailorDiffModal component exists but is NOT imported anywhere
```

### Dead Code Path: Full Resume Tailor via tailor-prompts.ts

```
tailorResume() function  (resume-tailor.server.ts, lines 42-161)
       |
       v
Uses tailor-prompts.ts TAILOR_PROMPT_V1 (lines 1-214)
       |
       v
Returns: enhanced_bullets[], suggested_bullets[], gaps[], enhanced_summary
       |
       v
TailoredResume model stores original + tailored JSON
       |
       v
*** NOTHING IN THE UI READS FROM TailoredResume MODEL ***
```

---

## 2. All LLM Prompts

### Prompt 1: Single Bullet Tailor (ACTIVE - the only rewrite users can access)
- **File:** `app/utils/openai.server.ts`, lines 307-447
- **Function:** `getBuilderExperienceResponse()`
- **Model:** gpt-5.2, temperature 0.5
- **Input:** One bullet point + full resume context + job description + extracted keywords
- **What it does:** Returns 3 rewrite options from different angles (Impact, Alignment, Transferable)
- **Output format:** `{ options: [{angle, bullet}], keyword_coverage_note, weak_bullet_flag, coverage_gap_flag }`
- **Where output goes:** Displayed in AIAssistantModal (`app/components/ai-assistant-modal.tsx`). User picks one, it replaces the single bullet in the builder form.
- **Key limitation:** Rewrites ONE bullet at a time. To tailor an entire resume, user must repeat this 10-20 times.

### Prompt 2: Bullet Generation (ACTIVE)
- **File:** `app/utils/openai.server.ts`, lines 496-686
- **Function:** `getBuilderGeneratedExperienceResponse()`
- **Model:** gpt-5.2, temperature 0.5
- **Input:** Job title, JD, current role + company, optional target keyword
- **What it does:** Generates 3-5 NEW bullet points for a given role. Two modes:
  - Keyword-focused: 3 bullets incorporating a specific missing keyword
  - Generic: 5 bullets with ATS-optimized language
- **Output format:** `{ experiences: ["bullet1", "bullet2", ...] }`
- **Where output goes:** AIAssistantModal "generate" tab. User selects bullets to add.

### Prompt 3: Entire Resume Tailor (DISCONNECTED FROM UI)
- **File:** `app/utils/openai.server.ts`, lines 213-305
- **Function:** `getEntireTailoredResumeResponse()`
- **Model:** gpt-5.2, temperature 0.5
- **Input:** Full resume JSON + JD + job title + extracted keywords
- **What it does:** Rewrites ALL bullets, summary, and skills in one pass. Returns complete resume JSON.
- **Output format:** Full `ResumeData` JSON (same schema as input)
- **Where output goes:** API endpoint exists (`builder-completions.ts` lines 69-205) but **NO UI ELEMENT CALLS IT**. `TailorDiffModal` and `TailorFlowStepper` components exist in `app/components/` but are not imported or rendered anywhere.

### Prompt 4: Full Resume Tailor v2 (DISCONNECTED)
- **File:** `app/utils/resume-tailor.server.ts`, lines 42-161
- **Prompt file:** `app/prompts/tailor-prompts.ts`, lines 1-214
- **Function:** `tailorResume()`
- **Model:** gpt-5.2, temperature 0.4
- **Input:** Parsed resume (OpenAIResumeData format) + job description + optional additional context
- **What it does:** Enhanced bullets, suggested bullets, gap analysis, enhanced summary
- **Output format:** `{ enhanced_bullets[], suggested_bullets[], gaps[], enhanced_summary }`
- **Where output goes:** `TailoredResume` Prisma model exists (schema line 393-413) to store original + tailored. **But nothing in the UI creates, reads, or displays TailoredResume records.**

### Prompt 5: Keyword Extraction (ACTIVE)
- **File:** `app/utils/keyword-extraction.server.ts`
- **Function:** `extractKeywordsFromJD()`
- **Model:** gpt-5.2 (inferred)
- **Input:** Job description text
- **What it does:** Extracts 3-5 primary must-have keywords and 5-7 secondary keywords
- **Output:** `{ keywords: string[], primary: string[] }`
- **Where output goes:** Stored in Job.extractedKeywords. Fed to scoring engine and AI tailor prompts.

### Prompt 6: Job Description Parser (ACTIVE)
- **File:** `app/utils/openai.server.ts`, lines 799-835
- **Function:** `getParsedJobDescription()`
- **Model:** gpt-5-mini
- **Input:** Job title + JD text
- **Output:** Structured JD: title, summary, hard_skills, soft_skills, keywords, responsibilities

### Prompt 7: Resume Analyzer (ACTIVE)
- **File:** `app/utils/openai.server.ts`, lines 837-907
- **Function:** `getAnalyzedResume()`
- **Model:** gpt-5-mini
- **Input:** Resume text or JSON
- **Output:** `{ summary, skills[], strengths[], concerns[], suggestions[], score }`

### Prompt 8: Job Fit Analysis (ACTIVE)
- **File:** `app/utils/openai.server.ts`, lines 909-1029
- **Function:** `getJobFit()`
- **Model:** gpt-5-mini
- **Input:** Job title + JD + resume
- **Output:** Match score, highlights, responsibilities alignment, skills matched/missing, recommendations

### Prompt 9: Resume File Parser (ACTIVE)
- **File:** `app/utils/openai-resume-parser.server.ts`
- **Input:** PDF/DOCX file text
- **Output:** Structured `OpenAIResumeData` with personal_info, experiences, education, skills, etc.

### Prompt 10: Recruiter Outreach (ACTIVE)
- **File:** `app/utils/openai.server.ts`, lines 1031-1084
- **Function:** `getRecruiterMessage()`
- **Model:** gpt-5-mini
- **Output:** Email, LinkedIn DM, connection note, follow-up message

### Prompt 11: Legacy Bullet Tailor - SSE stream (LEGACY)
- **File:** `app/utils/openai.server.ts`, lines 688-749
- **Function:** `getExperienceResponse()`
- **Model:** gpt-5.2, streaming
- **Input:** Bullet points + JD
- **What it does:** Rewrites bullets via SSE stream. Used by the old `/resources/completions` endpoint.

### Prompt 12: Legacy Bullet Generator - SSE stream (LEGACY)
- **File:** `app/utils/openai.server.ts`, lines 751-797
- **Function:** `getGeneratedExperienceResponse()`
- **Model:** gpt-5.2, streaming
- **Input:** JD + role info
- **What it does:** Generates experience bullets via SSE stream.

---

## 3. Data Model Summary

### Resume Storage (two parallel systems)

**System A: Old Resume model** (`prisma/schema.prisma` lines 184-204)
- `Resume` with related `Experience`, `Education`, `Skill` tables
- Flat text fields (responsibilities as a single string)
- Used by the `/resources/resume-tailor` route (old flow)

**System B: BuilderResume model** (`prisma/schema.prisma` lines 249-357)
- `BuilderResume` with `BuilderExperience`, `BuilderExperienceDescription`, `BuilderEducation`, `BuilderSkill`
- Each bullet point is its own `BuilderExperienceDescription` record
- This is the ACTIVE system used by `/builder`
- Links to a `Job` for JD context
- Has `ResumeScore` for persisted scores
- **No "original vs tailored" versioning** -- edits are in-place mutations

**System C: TailoredResume model** (`prisma/schema.prisma` lines 393-413)
- Stores `originalResume` (JSON), `jobDescription`, `tailoredResume` (JSON), `promptVersion`
- Designed for before/after comparison
- **Not connected to any UI -- zero records are ever created by any active code path**

**System D: BulletTailorLog model** (`prisma/schema.prisma` lines 415-442)
- Logs each single-bullet tailor request: original, JD, AI output, user action
- Used for QA/analytics only -- created in `builder-completions.ts` line 251-263

### Key fields for "rewrite" capability

| Field | Where | Contains |
|-------|-------|----------|
| `BuilderExperienceDescription.content` | BuilderResume | Individual bullet text (editable) |
| `BuilderResume.about` | BuilderResume | Summary/about section |
| `BuilderResume.role` | BuilderResume | Target role title |
| `BuilderSkill.name` | BuilderResume | Individual skill |
| `Job.content` | Job | Raw JD text |
| `Job.extractedKeywords` | Job | JSON of AI-extracted keywords |
| `TailoredResume.originalResume` | TailoredResume | Pre-tailor snapshot (UNUSED) |
| `TailoredResume.tailoredResume` | TailoredResume | Post-tailor result (UNUSED) |

---

## 4. The Gap

### What users expect
"I paste my resume and a job description. I click a button. My resume is rewritten to match the JD."

### What actually happens
1. User uploads resume, pastes JD
2. System shows a **checklist of issues** (missing keywords, weak verbs, no metrics)
3. To fix ANY issue, user must:
   a. Click on a specific bullet
   b. Open the AI modal
   c. Click "Tailor Achievement"
   d. Wait for AI response
   e. Review 3 options
   f. Click "Accept" on one
   g. Repeat for EVERY bullet (10-20 times)
4. Skills section: user must manually click "Add to Skills" for each missing keyword
5. Summary: user must manually rewrite

### The specific disconnections

1. **`getEntireTailoredResumeResponse()` exists but has no UI trigger.** The function at `openai.server.ts:213` rewrites the entire resume in one API call. The endpoint at `builder-completions.ts:69` accepts `entireResume === 'true'`. But no button, no component, no form in the builder sends that parameter.

2. **`TailorDiffModal` is dead code.** The component at `app/components/tailor-diff-modal.tsx` shows a beautiful before/after diff with "Keep Changes" and "Revert" buttons. It is never rendered.

3. **`TailorFlowStepper` is dead code.** The component at `app/components/tailor-flow-stepper.tsx` guides users through Upload -> Select Job -> Tailor -> Download. It is never rendered.

4. **`TailoredResume` model is dead.** The database table exists (schema line 393) with `originalResume`, `tailoredResume`, `promptVersion`. No code creates records in it.

5. **`tailorResume()` in `resume-tailor.server.ts` is dead.** This function uses a detailed prompt (`tailor-prompts.ts`) that returns enhanced bullets, suggested bullets, gaps, and enhanced summary. Nothing calls it from any route handler.

6. **The checklist has `fixType` actions but most require manual effort.** The `ChecklistItem.fixType` enum includes `'ai-modal'`, `'keyword-popover'`, `'skills-add'`, `'generate-bullets'`, etc. But these just open modals or scroll to sections -- they don't automatically apply fixes.

7. **No snapshot/versioning.** When a user accepts a bullet rewrite, the original is overwritten. There's no undo (except the `TailorDiffModal` which isn't wired up). The `TailoredResume` model was designed for this but is unused.

---

## 5. Recommended Changes (ordered by impact)

### HIGH IMPACT

#### 1. Wire up the "Tailor Entire Resume" button
- **Files to modify:**
  - `app/routes/builder+/index.tsx` -- Add a "Tailor to Job" button in the toolbar/sidebar
  - Already-built backend: `app/routes/resources+/builder-completions.ts` lines 69-205 (the `entireResume === 'true'` branch)
  - Already-built API call: `app/utils/openai.server.ts` lines 213-305 (`getEntireTailoredResumeResponse`)
- **What to do:** Add a prominent button that sends `{ entireResume: 'true', resumeData: JSON.stringify(formData), jobDescription, jobTitle }` to `/resources/builder-completions`. Parse the response (which is a full `ResumeData` JSON) and apply it to the builder form state.
- **Effort:** Low -- the API, prompt, and error handling all exist.

#### 2. Activate TailorDiffModal for review
- **Files to modify:**
  - `app/routes/builder+/index.tsx` -- Import and render `TailorDiffModal`
  - `app/utils/tailor-diff.ts` -- Already has `detectChanges()` and `buildDiffSummary()`
  - `app/components/tailor-diff-modal.tsx` -- Already complete
- **What to do:** After the entire-resume tailor returns, snapshot the current form state as "before," apply the AI response as "after," then show `TailorDiffModal` with Keep/Revert buttons.
- **Effort:** Low -- components and diff logic already exist.

#### 3. Add snapshot/versioning before tailor
- **Files to modify:**
  - `app/routes/builder+/index.tsx` -- Store pre-tailor state in component state or in `TailoredResume` table
  - `prisma/schema.prisma` -- `TailoredResume` model already exists
  - `app/routes/resources+/builder-completions.ts` -- Save to `TailoredResume` after successful tailor
- **What to do:** Before applying tailor changes, save the original to `TailoredResume`. This enables undo and before/after comparison.
- **Effort:** Low-medium.

### MEDIUM IMPACT

#### 4. Auto-apply checklist fixes
- **File:** `app/routes/builder+/index.tsx`, `app/utils/resume-scoring.ts`
- **What to do:** For `fixType: 'skills-add'`, automatically add missing keywords to the skills array. For `fixType: 'auto-reorder'`, automatically reorder bullets. For `fixType: 'ai-modal'`, batch multiple bullets into one AI call.
- **Effort:** Medium.

#### 5. Connect the Analyze flow to Builder
- **Files:** `app/routes/analyze+/results.$id.tsx`, `app/routes/builder+/index.tsx`
- **What to do:** Add a "Apply to Builder" button on analyze results that creates a BuilderResume with the suggested changes pre-applied.
- **Effort:** Medium.

### LOWER IMPACT

#### 6. Activate TailorFlowStepper
- **File:** `app/routes/builder+/index.tsx`
- **What to do:** Import and render `TailorFlowStepper` for new users. The component already handles all 4 steps.
- **Effort:** Very low.

#### 7. Connect `tailorResume()` alternative prompt
- **Files:** `app/utils/resume-tailor.server.ts`, `app/prompts/tailor-prompts.ts`
- **What to do:** This prompt returns structured `enhanced_bullets` with before/after pairs plus `suggested_bullets` with evidence. Could be used as an alternative to `getEntireTailoredResumeResponse` for users who want a more granular review.
- **Effort:** Medium -- would need a new UI to display the structured diff.

---

## 6. Quick Win

**The smallest change that lets a user get a fully rewritten resume:**

Add a single button to `app/routes/builder+/index.tsx` that calls the existing `entireResume` endpoint.

### What already works:
1. `getEntireTailoredResumeResponse()` -- rewrites all bullets, summary, skills in one API call (openai.server.ts:213)
2. The API route handler for `entireResume === 'true'` -- handles errors, tracks analytics, increments counters (builder-completions.ts:69-205)
3. The response format matches `ResumeData` -- can be directly applied to the builder form state
4. `TailorDiffModal` -- shows before/after with Keep/Revert buttons (tailor-diff-modal.tsx)
5. `detectChanges()` and `buildDiffSummary()` -- compute what changed (tailor-diff.ts)

### What needs to be built:
1. A "Tailor Entire Resume" button in the builder toolbar (approximately 20 lines of JSX)
2. A handler that:
   - Snapshots current `formData` as "before"
   - Submits to `/resources/builder-completions` with `entireResume: 'true'`
   - Parses the response and applies to `formData`
   - Opens `TailorDiffModal` with the diff
   - On "Keep Changes" -- saves the form
   - On "Revert" -- restores the snapshot

This is an estimated 50-100 lines of code in the builder route, connecting infrastructure that is already fully implemented and tested. The prompt, API endpoint, error handling, diff computation, and review UI all exist -- they just need to be wired together.

### Why this solves the user complaint:
- User uploads resume, pastes JD, clicks ONE button
- AI rewrites everything: bullets get keywords, summary gets optimized, skills get added
- User sees a clear before/after diff
- User clicks "Keep Changes" or "Revert"
- Total interaction: 3 clicks instead of 30+
