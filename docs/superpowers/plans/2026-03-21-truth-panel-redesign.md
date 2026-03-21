# Truth Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the keyword-score right panel with an evidence-based Truth Panel, add Application Tracker page, and Cover Letter slide-over.

**Architecture:** Swap the 390px score panel contents with a new TruthPanel component that shows AI-powered experience match analysis. Add Application model for tracking, ExperienceMatchCache for caching AI results. Extract nav bar and onboarding widget into separate files before making functional changes.

**Tech Stack:** Remix v2.3, React 18, Prisma/SQLite, OpenAI (GPT-5-mini structured outputs, GPT-5.2 plain text), existing design tokens (lightTheme/darkTheme, BRAND/SUCCESS/WARN/ERROR constants), Zod, useFetcher pattern.

**Spec:** `docs/superpowers/specs/2026-03-21-truth-panel-redesign.md`

---

## File Structure

### New files
- `prisma/migrations/[timestamp]_add_applications/migration.sql` — Prisma auto-generated
- `app/utils/application.server.ts` — Application CRUD
- `app/utils/ai/experience-match.server.ts` — GPT-5-mini experience match
- `app/utils/ai/cover-letter.server.ts` — GPT-5.2 cover letter generation
- `app/components/builder-nav.tsx` — extracted nav bar
- `app/components/onboarding-widget.tsx` — extracted onboarding widget
- `app/components/truth-panel.tsx` — replaces score panel contents
- `app/components/cover-letter-panel.tsx` — slide-over for cover letter
- `app/routes/resources+/experience-match.ts` — experience match API
- `app/routes/resources+/generate-cover-letter.ts` — cover letter API
- `app/routes/resources+/applications.ts` — application CRUD API
- `app/routes/tracker.tsx` — Application Tracker page

### Modified files
- `prisma/schema.prisma` — add Application, ExperienceMatchCache models; add coverLetterDrafts to BuilderResume; add reverse relations
- `app/utils/builder-resume.server.ts` — add `company` to BuilderJob type; add `coverLetterDrafts` to ResumeData type; update getBuilderResume job select; update updateBuilderResume
- `app/routes/builder+/index.tsx` — extract nav/onboarding, replace score panel with TruthPanel, remove dead score code
- `app/hooks/use-onboarding-flow.ts` — update stages for new steps
- `app/utils/onboarding.ts` — update OnboardingStage type and stage logic

### Deleted files (cleanup)
- `app/hooks/use-resume-score.ts` — dead code after score panel removal

---

## Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Application model to schema**

In `prisma/schema.prisma`, add after the `ResumeScore` model (line 397):

```prisma
model Application {
  id              String    @id @default(cuid())
  userId          String
  resumeId        String
  jobId           String
  matchLevel      String
  matchSummary    String?
  status          String    @default("applied")
  coverLetter     String?
  appliedAt       DateTime  @default(now())
  statusUpdatedAt DateTime  @default(now())
  nextCheckIn     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user   User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  resume BuilderResume @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  job    Job           @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, status])
  @@index([nextCheckIn])
}
```

- [ ] **Step 2: Add ExperienceMatchCache model**

Add after the Application model:

```prisma
model ExperienceMatchCache {
  id         String   @id @default(cuid())
  resumeId   String
  jobId      String
  resumeHash String
  jobHash    String
  resultJson String
  createdAt  DateTime @default(now())

  resume BuilderResume @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  job    Job           @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@unique([resumeId, jobId])
  @@index([resumeId])
}
```

- [ ] **Step 3: Add reverse relations and new fields to existing models**

Add `applications Application[]` to:
- `User` model (after line 77, alongside `builderResumes`)
- `BuilderResume` model (after line 275, alongside `scores`)
- `Job` model (after line 133, alongside `scores`)

Add to `BuilderResume` (after `templateHtml` field, line 281):
```prisma
  coverLetterDrafts  String?
```

Add reverse relations to `BuilderResume` and `Job` for ExperienceMatchCache:
```prisma
  experienceMatchCache ExperienceMatchCache[]
```

- [ ] **Step 4: Run migration**

Run: `npx prisma migrate dev --name add_applications_and_match_cache`
Expected: Migration created and applied successfully.

- [ ] **Step 5: Verify Prisma client generates correctly**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Application, ExperienceMatchCache models and coverLetterDrafts field"
```

---

## Task 2: Update BuilderJob Type and ResumeData

**Files:**
- Modify: `app/utils/builder-resume.server.ts:48-83` (BuilderJob type, ResumeData type)
- Modify: `app/utils/builder-resume.server.ts:314-320` (getBuilderResume job select)

- [ ] **Step 1: Add `company` to BuilderJob type**

At `app/utils/builder-resume.server.ts:48-53`, change:

```typescript
export type BuilderJob = {
	id?: string | null
	title?: string | null
	content?: string | null
	extractedKeywords?: string | null
}
```

To:

```typescript
export type BuilderJob = {
	id?: string | null
	title?: string | null
	company?: string | null
	content?: string | null
	extractedKeywords?: string | null
}
```

- [ ] **Step 2: Add `coverLetterDrafts` to ResumeData type**

At `app/utils/builder-resume.server.ts`, add after `templateHtml` (line 82):

```typescript
	coverLetterDrafts?: string | null
```

- [ ] **Step 3: Update getBuilderResume job select to include company**

In the `getBuilderResume` function, find the job relation select (around line 314-320) and add `company`:

```typescript
job: {
	select: {
		id: true,
		title: true,
		company: true,
		content: true,
		extractedKeywords: true,
	},
},
```

- [ ] **Step 4: Update updateBuilderResume to handle coverLetterDrafts**

In the `updateBuilderResume` function (around line 176), the function destructures `data` as `const { id, job, jobId, ...updateData } = data`. The `coverLetterDrafts` field will flow through `updateData` automatically since it's a simple string field on BuilderResume. Verify by reading the destructuring and the Prisma update call — no explicit exclusion of this field should exist.

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add app/utils/builder-resume.server.ts
git commit -m "feat: add company to BuilderJob type and coverLetterDrafts to ResumeData"
```

---

## Task 3: Extract Nav Bar Component (Move-Only)

**Files:**
- Create: `app/components/builder-nav.tsx`
- Modify: `app/routes/builder+/index.tsx:2781-3190`

This is a move-only extraction. No functional changes.

- [ ] **Step 1: Read and identify the nav bar section**

Read `app/routes/builder+/index.tsx` — search for `{/* TOP BAR */}` comment (around line 2781). Read through ~line 3190 to capture the complete nav bar JSX. Also identify all state, handlers, and refs used by the nav bar:

State used: `sidebar`, `isDark`, `showCommandPalette`, `scorePanel`, `downloadClicked`, `tailorPanelOpen`, `profileOpen`, `hasTailorSnapshot`
Refs used: `profileRef`, `logoutFormRef`, `manageSubFormRef`
Handlers used: `toggleDarkMode`, `handleClickDownloadPDF`, `handleUndoTailor`
Data used: `c` (theme), `sW`, `formData`, `saveStatus`, `user`, `subscription`, `fetcher`

- [ ] **Step 2: Create builder-nav.tsx with the extracted JSX**

Create `app/components/builder-nav.tsx`. Define a `BuilderNavProps` interface accepting all the state, handlers, and data the nav bar needs as props. Move the nav bar JSX into a `BuilderNav` component. Use `import type` for `ResumeData`, `BuilderJob` from `~/utils/builder-resume.server.ts`.

The component should be a direct copy of the nav bar JSX from the builder, with all state references replaced by props. Keep inline styles exactly as-is.

- [ ] **Step 3: Replace nav bar in builder with the extracted component**

In `app/routes/builder+/index.tsx`, replace lines 2781-3190 with `<BuilderNav {...navProps} />`, passing all required state and handlers as props.

- [ ] **Step 4: Verify the app renders correctly**

Run: `npm run dev` and visually confirm the nav bar looks and functions identically.
Run: `npx tsc --noEmit` — no type errors.

- [ ] **Step 5: Commit (move-only)**

```bash
git add app/components/builder-nav.tsx app/routes/builder+/index.tsx
git commit -m "refactor: extract nav bar to builder-nav.tsx (move-only, no functional changes)"
```

---

## Task 4: Extract Onboarding Widget (Move-Only)

**Files:**
- Create: `app/components/onboarding-widget.tsx`
- Modify: `app/routes/builder+/index.tsx:4934-5115`

Move-only extraction. No functional changes.

- [ ] **Step 1: Read and identify the onboarding widget section**

Read `app/routes/builder+/index.tsx` — search for the onboarding widget section (around line 4934, fixed-position bottom-right container). Identify state used: `onboardingDismissed`, `onboardingCollapsed`, `coachStep`, `formData`, `selectedJob`, `gettingStartedProgress`, `c` (theme).

- [ ] **Step 2: Create onboarding-widget.tsx with the extracted JSX**

Create `app/components/onboarding-widget.tsx`. Define an `OnboardingWidgetProps` interface. Move the widget JSX (the fixed-position bottom-right container with step list) into an `OnboardingWidget` component.

Include the step definitions array (resume/job/tailor with completion conditions) inside the component since they're self-contained.

- [ ] **Step 3: Replace in builder with the extracted component**

In `app/routes/builder+/index.tsx`, replace lines 4934-5115 with `<OnboardingWidget {...onboardingProps} />`.

- [ ] **Step 4: Verify renders correctly**

Run: `npm run dev` and visually confirm widget appears and functions identically.
Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit (move-only)**

```bash
git add app/components/onboarding-widget.tsx app/routes/builder+/index.tsx
git commit -m "refactor: extract onboarding widget to onboarding-widget.tsx (move-only)"
```

---

## Task 5: Application Server Utilities

**Files:**
- Create: `app/utils/application.server.ts`
- Test: manual verification via Prisma Studio or route tests later

- [ ] **Step 1: Create application.server.ts with CRUD functions**

```typescript
import { prisma } from './db.server.ts'

export async function createApplication(
	userId: string,
	resumeId: string,
	jobId: string,
	matchLevel: string,
	matchSummary: string | null,
	coverLetter?: string | null,
) {
	return prisma.application.create({
		data: {
			userId,
			resumeId,
			jobId,
			matchLevel,
			matchSummary,
			coverLetter,
			nextCheckIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		},
	})
}

export async function getUserApplications(userId: string) {
	return prisma.application.findMany({
		where: { userId },
		include: {
			resume: { select: { id: true, name: true, role: true } },
			job: { select: { id: true, title: true, company: true } },
		},
		orderBy: { appliedAt: 'desc' },
	})
}

export async function updateApplicationStatus(
	applicationId: string,
	userId: string,
	status: string,
) {
	const terminal = ['offered', 'rejected']
	return prisma.application.update({
		where: { id: applicationId, userId },
		data: {
			status,
			statusUpdatedAt: new Date(),
			...(terminal.includes(status) ? { nextCheckIn: null } : {}),
		},
	})
}

export async function deleteApplication(applicationId: string, userId: string) {
	return prisma.application.delete({
		where: { id: applicationId, userId },
	})
}

// TODO: Phase 6 — check-in emails (getApplicationsDueForCheckIn, email sending, cron endpoint with shared secret auth)
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/utils/application.server.ts
git commit -m "feat: add Application CRUD server utilities"
```

---

## Task 6: Experience Match AI Function

**Files:**
- Create: `app/utils/ai/experience-match.server.ts`

- [ ] **Step 1: Create `app/utils/ai/` directory**

The directory does not exist yet. Create it before writing files.

Run: `mkdir -p app/utils/ai`

- [ ] **Step 2: Create the experience match types and function**

Read `app/utils/openai.server.ts` first to understand the existing OpenAI client pattern: uses `openai.chat.completions.create()` with `response_format` param (NOT the `.parse()` API), `zodResponseFormat` from `openai/helpers/zod`, and manual JSON parsing of `response.choices[0]?.message?.content`.

Create `app/utils/ai/experience-match.server.ts`:

```typescript
import { z } from 'zod'
import { OpenAI } from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import type { ResumeData } from '../builder-resume.server.ts'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'test-key' })

const BestMoveSchema = z.object({
	id: z.string(),
	type: z.enum([
		'cover_letter', 'address_gap', 'referral',
		'rewrite_bullets', 'dont_apply', 'linkedin',
	]),
	headline: z.string(),
	explanation: z.string(),
	actionable: z.boolean(),
	evidenceNote: z.string().optional(),
})

const ExperienceMatchSchema = z.object({
	level: z.enum(['strong', 'moderate', 'weak', 'mismatch']),
	summary: z.string(),
	requirementsCovered: z.number(),
	requirementsTotal: z.number(),
	bestMoves: z.array(BestMoveSchema).max(4),
})

export type ExperienceMatch = z.infer<typeof ExperienceMatchSchema>
export type BestMove = z.infer<typeof BestMoveSchema>

const DEFAULT_COVER_LETTER_MOVE: BestMove = {
	id: 'default-cover-letter',
	type: 'cover_letter',
	headline: 'Write a cover letter',
	explanation: 'A tailored cover letter significantly increases your callback rate for this role.',
	actionable: true,
	evidenceNote: 'Tailored cover letters increase callbacks by 53% (ResumeGo, n=7,287)',
}

const DEFAULT_REFERRAL_MOVE: BestMove = {
	id: 'default-referral',
	type: 'referral',
	headline: 'A referral would 10x your odds',
	explanation: 'Cold applications have a ~2% response rate. A warm introduction from someone at the company dramatically improves your chances.',
	actionable: false,
	evidenceNote: 'Referred candidates are 4-5x more likely to be hired (LinkedIn Economic Graph)',
}

function postProcess(result: ExperienceMatch): ExperienceMatch {
	const moves = [...result.bestMoves]
	const needsCoverLetter =
		(result.level === 'strong' || result.level === 'moderate') &&
		!moves.some(m => m.type === 'cover_letter')
	const needsReferral = !moves.some(m => m.type === 'referral')

	if (needsCoverLetter) moves.unshift(DEFAULT_COVER_LETTER_MOVE)
	if (needsReferral) moves.push(DEFAULT_REFERRAL_MOVE)

	// Trim to 4: keep cover_letter first, referral last, trim middle
	if (moves.length > 4) {
		const first = moves[0]
		const last = moves[moves.length - 1]
		const middle = moves.slice(1, -1).slice(0, 2)
		return { ...result, bestMoves: [first, ...middle, last] }
	}

	return { ...result, bestMoves: moves }
}

export async function getExperienceMatch(
	resumeData: ResumeData,
	jobDescription: string,
): Promise<ExperienceMatch> {
	const resumeSummary = [
		resumeData.about,
		...(resumeData.experiences ?? []).map(e =>
			`${e.role} at ${e.company}: ${e.descriptions?.map(d => d.content).join('; ')}`
		),
		`Skills: ${(resumeData.skills ?? []).map(s => s.name).join(', ')}`,
		...(resumeData.education ?? []).map(e => `${e.degree} at ${e.school}`),
	].filter(Boolean).join('\n')

	const experienceMatchResponseFormat = zodResponseFormat(ExperienceMatchSchema, 'experience_match')

	const response = await openai.chat.completions.create({
		model: 'gpt-5-mini',
		messages: [
			{
				role: 'system',
				content: `You assess how well a candidate's actual experience matches a job description. Compare real experience against requirements — not keyword overlap.

Rules:
- Be honest. "mismatch" and "dont_apply" are valid outputs.
- Detect employment gaps from resume dates and recommend addressing them if present.
- Always include a cover_letter best move if match level is moderate or strong.
- Always include a referral recommendation.
- Evidence notes must cite real research with numbers.
- Max 4 best moves.
- Summary should be 1-2 plain-language sentences. Example: "Your 4 years of product management covers 5 of 6 core requirements. The gap: they want experience with enterprise sales cycles."`,
			},
			{
				role: 'user',
				content: `Resume:\n${resumeSummary}\n\nJob Description:\n${jobDescription}`,
			},
		],
		response_format: experienceMatchResponseFormat,
	})

	const content = response.choices[0]?.message?.content
	if (!content) throw new Error('Failed to get experience match response')
	const result = ExperienceMatchSchema.parse(JSON.parse(content))

	return postProcess(result)
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/utils/ai/experience-match.server.ts
git commit -m "feat: add experience match AI function with post-processing"
```

---

## Task 7: Cover Letter AI Function

**Files:**
- Create: `app/utils/ai/cover-letter.server.ts`

- [ ] **Step 1: Create the cover letter generation function**

```typescript
import { OpenAI } from 'openai'
import type { ResumeData } from '../builder-resume.server.ts'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'test-key' })

export async function generateCoverLetter(
	resumeData: ResumeData,
	jobDescription: string,
	jobTitle: string,
	company: string,
): Promise<string> {
	const resumeSummary = [
		resumeData.about,
		...(resumeData.experiences ?? []).map(e =>
			`${e.role} at ${e.company}: ${e.descriptions?.map(d => d.content).join('; ')}`
		),
		`Skills: ${(resumeData.skills ?? []).map(s => s.name).join(', ')}`,
	].filter(Boolean).join('\n')

	const response = await openai.chat.completions.create({
		model: 'gpt-5.2',
		messages: [
			{
				role: 'system',
				content: `Write a professional cover letter. Reference specific experience from the resume that matches the job. Under 400 words. No cliches ("I am writing to express my interest..."). Match the seniority level of the role. Be direct and specific.`,
			},
			{
				role: 'user',
				content: `Resume:\n${resumeSummary}\n\nJob Title: ${jobTitle}\nCompany: ${company}\nJob Description:\n${jobDescription}`,
			},
		],
	})

	return response.choices[0]?.message?.content ?? ''
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/utils/ai/cover-letter.server.ts
git commit -m "feat: add cover letter generation AI function"
```

---

## Task 8: Experience Match API Route

**Files:**
- Create: `app/routes/resources+/experience-match.ts`

- [ ] **Step 1: Create the route with cache logic**

```typescript
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { createHash } from 'crypto'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { getExperienceMatch } from '~/utils/ai/experience-match.server.ts'
import type { ResumeData } from '~/utils/builder-resume.server.ts'

function hashContent(data: unknown): string {
	return createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

function buildResumeHashInput(r: ResumeData) {
	return {
		about: r.about,
		experiences: (r.experiences ?? []).map(e => ({
			role: e.role,
			descriptions: e.descriptions?.map(d => d.content),
		})),
		skills: (r.skills ?? []).map(s => s.name),
		education: (r.education ?? []).map(e => ({ degree: e.degree, school: e.school })),
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 })

	const body = await request.json()
	const { resumeId, jobId } = body as { resumeId: string; jobId: string }

	const [resume, job] = await Promise.all([
		prisma.builderResume.findUnique({
			where: { id: resumeId, userId },
			include: {
				experiences: { include: { descriptions: true } },
				education: true,
				skills: true,
			},
		}),
		prisma.job.findUnique({ where: { id: jobId } }),
	])

	if (!resume || !job) return json({ error: 'Not found' }, { status: 404 })

	const resumeData: ResumeData = {
		about: resume.about,
		experiences: resume.experiences.map(e => ({
			id: e.id,
			role: e.role,
			company: e.company,
			startDate: e.startDate,
			endDate: e.endDate,
			descriptions: e.descriptions.map(d => ({ id: d.id, content: d.content })),
		})),
		education: resume.education.map(e => ({
			id: e.id,
			school: e.school,
			degree: e.degree,
			startDate: e.startDate,
			endDate: e.endDate,
			description: e.description,
		})),
		skills: resume.skills.map(s => ({ id: s.id, name: s.name })),
		visibleSections: null,
	}

	const resumeHash = hashContent(buildResumeHashInput(resumeData))
	const jobHash = hashContent(job.content)

	const cached = await prisma.experienceMatchCache.findUnique({
		where: { resumeId_jobId: { resumeId, jobId } },
	})

	if (cached && cached.resumeHash === resumeHash && cached.jobHash === jobHash) {
		return json(JSON.parse(cached.resultJson))
	}

	const result = await getExperienceMatch(resumeData, job.content)

	await prisma.experienceMatchCache.upsert({
		where: { resumeId_jobId: { resumeId, jobId } },
		create: { resumeId, jobId, resumeHash, jobHash, resultJson: JSON.stringify(result) },
		update: { resumeHash, jobHash, resultJson: JSON.stringify(result) },
	})

	return json(result)
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/routes/resources+/experience-match.ts
git commit -m "feat: add experience match API route with caching"
```

---

## Task 9: Cover Letter and Applications API Routes

**Files:**
- Create: `app/routes/resources+/generate-cover-letter.ts`
- Create: `app/routes/resources+/applications.ts`

- [ ] **Step 1: Create generate-cover-letter route**

```typescript
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { generateCoverLetter } from '~/utils/ai/cover-letter.server.ts'

export async function action({ request }: ActionFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 })

	const { resumeId, jobId } = (await request.json()) as { resumeId: string; jobId: string }

	const [resume, job] = await Promise.all([
		prisma.builderResume.findUnique({
			where: { id: resumeId, userId },
			include: {
				experiences: { include: { descriptions: true } },
				education: true,
				skills: true,
			},
		}),
		prisma.job.findUnique({ where: { id: jobId } }),
	])

	if (!resume || !job) return json({ error: 'Not found' }, { status: 404 })

	const resumeData = {
		about: resume.about,
		experiences: resume.experiences.map(e => ({
			id: e.id,
			role: e.role,
			company: e.company,
			startDate: e.startDate,
			endDate: e.endDate,
			descriptions: e.descriptions.map(d => ({ id: d.id, content: d.content })),
		})),
		education: resume.education.map(e => ({
			id: e.id,
			school: e.school,
			degree: e.degree,
			startDate: e.startDate,
			endDate: e.endDate,
			description: e.description,
		})),
		skills: resume.skills.map(s => ({ id: s.id, name: s.name })),
		visibleSections: null,
	}

	const text = await generateCoverLetter(
		resumeData,
		job.content,
		job.title,
		job.company ?? '',
	)

	// TODO: Add AI usage limit tracking here — check GettingStartedProgress.tailorCount
	// or equivalent counter, and enforce subscription gate for non-subscribers.
	// Follow the same pattern as bullet tailoring in openai.server.ts.

	return json({ coverLetter: text })
}
```

- [ ] **Step 2: Create applications route with intent-based dispatch**

```typescript
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import {
	createApplication,
	updateApplicationStatus,
	deleteApplication,
} from '~/utils/application.server.ts'

export async function action({ request }: ActionFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 })

	const body = await request.json()
	const intent = body.intent as string

	if (intent === 'create') {
		const { resumeId, jobId, matchLevel, matchSummary } = body

		// Extract cover letter draft for this job from the resume's drafts map
		const resume = await prisma.builderResume.findUnique({
			where: { id: resumeId, userId },
			select: { coverLetterDrafts: true },
		})
		let coverLetter: string | null = null
		if (resume?.coverLetterDrafts) {
			try {
				const drafts = JSON.parse(resume.coverLetterDrafts)
				coverLetter = drafts[jobId] ?? null
			} catch { /* ignore parse errors */ }
		}

		const app = await createApplication(userId, resumeId, jobId, matchLevel, matchSummary, coverLetter)
		return json({ success: true, applicationId: app.id })
	}

	if (intent === 'update-status') {
		const { applicationId, status } = body
		await updateApplicationStatus(applicationId, userId, status)
		return json({ success: true })
	}

	if (intent === 'delete') {
		const { applicationId } = body
		await deleteApplication(applicationId, userId)
		return json({ success: true })
	}

	return json({ error: 'Unknown intent' }, { status: 400 })
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/routes/resources+/generate-cover-letter.ts app/routes/resources+/applications.ts
git commit -m "feat: add cover letter generation and applications API routes"
```

---

## Task 10: Truth Panel Component

**Files:**
- Create: `app/components/truth-panel.tsx`
- Modify: `app/routes/builder+/index.tsx`

- [ ] **Step 1: Create truth-panel.tsx**

Read the design reference at `design-reference/resume_builder_the_truth_panel_final/screen.png` and `design-reference/resume_builder_the_truth_panel_final/code.html` for visual guidance.

Build the component with three sections (Experience Match, Best Moves, Task Status). Use `useFetcher` to call `/resources/experience-match`. Match existing inline styling patterns from the builder — use `c.bgSurf`, `c.bgEl`, `c.border`, `c.text`, `c.muted`, `c.dim`, `c.brandText` from the theme prop.

Props:
```typescript
import type { ResumeData, BuilderJob } from '~/utils/builder-resume.server.ts'
import type { ExperienceMatch } from '~/utils/ai/experience-match.server.ts'

interface TruthPanelProps {
	formData: ResumeData
	selectedJob: BuilderJob | null
	theme: { bg: string; bgEl: string; bgSurf: string; border: string; borderSub: string; text: string; muted: string; dim: string; canvas: string; white: string; brandText: string }
	onGenerateCoverLetter: () => void
	onScrollToSection: (section: string) => void
}
```

Key implementation details:
- Use constants `BRAND`, `SUCCESS`, `WARN`, `ERROR` directly (import or define — match builder pattern at lines 261-268)
- Match level colors: strong → SUCCESS, moderate → BRAND, weak → WARN, mismatch → ERROR
- Section labels: `fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: c.dim` (matches existing section label style)
- Loading state: pulsing skeleton blocks with `c.bgSurf` background
- Error state: "Couldn't analyze match" + "Retry" button
- Fetch on mount and when `selectedJob` changes (useEffect with fetcher.submit)
- Task Status uses `CheckCircle2` (SUCCESS fill) and `Circle` (c.dim) icons from lucide-react

- [ ] **Step 2: Replace score panel contents in builder**

In `app/routes/builder+/index.tsx`, find the score panel section by searching for the comment `{/* SCORE PANEL */}` (originally ~line 3727, but line numbers shift after Tasks 3-4 extractions). Keep the outer container div (390px width, borderLeft, c.bgEl background). Replace everything inside it with:

```tsx
<TruthPanel
	formData={formData}
	selectedJob={selectedJob ?? null}
	theme={c}
	onGenerateCoverLetter={() => setCoverLetterOpen(true)}
	onScrollToSection={(section) => {
		setActiveSection(section)
		// scroll logic if needed
	}}
/>
```

Add state: `const [coverLetterOpen, setCoverLetterOpen] = useState(false)`

- [ ] **Step 3: Remove dead score code from builder**

Remove from `app/routes/builder+/index.tsx`:
- `ScoreArc` component (lines 385-460)
- `tiers` array (lines 298-305)
- `getTier` function (lines 306-307)
- `scoreMsg` function (lines 308-317)
- `showScoreDetail` state (line 791) and all its references
- `keywordPopover` state (lines 771-775) and all handlers/JSX (~lines 1386-1405, 2432-2570)
- `skillsAddPopover` state (lines 776-780) and all JSX (~lines 2571-2640)
- `summaryFixModal` state (lines 781-784) and all JSX
- `checklistClickRect` ref (line 785)
- Score detail slide-over (lines 4581-4800+)
- `useResumeScore` import and hook call
- `parseTieredKeywords` import
- Remove `Target`, `TrendingUp`, `Zap`, `AlignLeft` from lucide imports if no longer used elsewhere in the file

- [ ] **Step 4: Verify app renders**

Run: `npm run dev` — confirm Truth Panel appears in right panel, score panel is gone.
Run: `npx tsc --noEmit` — no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/truth-panel.tsx app/routes/builder+/index.tsx
git commit -m "feat: replace score panel with Truth Panel component"
```

---

## Task 11: Cover Letter Panel Component

**Files:**
- Create: `app/components/cover-letter-panel.tsx`
- Modify: `app/routes/builder+/index.tsx`

- [ ] **Step 1: Create cover-letter-panel.tsx**

Read `design-reference/cover_letter_slide_over_final/screen.png` and `code.html` for visual guidance. Read `app/components/tailor-panel.tsx` for the existing slide-over panel pattern.

```typescript
import type { ResumeData, BuilderJob } from '~/utils/builder-resume.server.ts'

interface CoverLetterPanelProps {
	open: boolean
	onClose: () => void
	formData: ResumeData
	selectedJob: BuilderJob | null
	theme: { bg: string; bgEl: string; bgSurf: string; border: string; text: string; muted: string; dim: string; brandText: string; [key: string]: string }
	coverLetterText: string
	onTextChange: (text: string) => void
	onRegenerate: () => void
	isGenerating: boolean
}
```

Key implementation:
- Overlay same 390px right panel position (absolute within the panel container, or conditionally render instead of TruthPanel)
- Header: "← Back to Assessment" (button calling `onClose`), Regenerate/Copy/Download icon buttons
- Textarea with `fontFamily: 'Crimson Pro, Georgia, serif'`, full height, `c.bgSurf` background
- Copy: `navigator.clipboard.writeText(coverLetterText)`
- Download: create blob and download as .txt
- No auto-save logic here — parent manages save via `onTextChange`

- [ ] **Step 2: Wire into builder**

In `app/routes/builder+/index.tsx`:
- Add `coverLetterText` state, `isGeneratingCoverLetter` state
- Add cover letter fetcher for `/resources/generate-cover-letter`
- `onGenerateCoverLetter` handler: submit to fetcher, on response set `coverLetterText` and open panel
- Auto-save `coverLetterDrafts` on debounced text changes: update `formData.coverLetterDrafts` JSON map keyed by `selectedJob.id`, trigger save
- In the right panel container, conditionally render `CoverLetterPanel` over `TruthPanel` when `coverLetterOpen` is true

- [ ] **Step 3: Verify**

Run: `npm run dev` — click "Generate with AI" in Truth Panel, verify cover letter panel opens, text generates, can edit, back button works.
Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/components/cover-letter-panel.tsx app/routes/builder+/index.tsx
git commit -m "feat: add cover letter slide-over panel with generation and auto-save"
```

---

## Task 12: Download & Track Button

**Files:**
- Modify: `app/components/builder-nav.tsx`
- Modify: `app/routes/builder+/index.tsx`

- [ ] **Step 1: Update download button in builder-nav.tsx**

Change button text from "Download Resume" to "Download & Track". Keep the `Download` icon from lucide-react.

- [ ] **Step 2: Add application creation to download handler**

In the builder (where `handleDownloadPDF` is defined, around line 1788), after successful PDF generation:

```typescript
// After PDF generation succeeds, create application if job selected
if (selectedJob?.id && formData.id) {
	const matchFetcher = /* reference to the experience match fetcher data */
	applicationFetcher.submit(
		JSON.stringify({
			intent: 'create',
			resumeId: formData.id,
			jobId: selectedJob.id,
			matchLevel: matchData?.level ?? 'moderate',
			matchSummary: matchData?.summary ?? null,
		}),
		{ method: 'POST', action: '/resources/applications', encType: 'application/json' },
	)

	const checkInDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
	toast({
		title: 'Application tracked',
		description: `${selectedJob.title} at ${selectedJob.company ?? 'Unknown'}. We'll check in on ${checkInDate}.`,
	})
}
```

Add `applicationFetcher = useFetcher()` to the builder component.

- [ ] **Step 3: Remove score toggle button from nav**

In `builder-nav.tsx`, remove the `<Target>` icon button that shows the score number and toggles the score panel. The panel toggle button (`PanelRightClose`) can stay if it controls Truth Panel visibility.

- [ ] **Step 4: Add Tracker link to nav**

Add a "Tracker" link next to "Resumes" in the top nav area:

```tsx
<Link to="/tracker" style={{ fontSize: 14, color: c.muted, textDecoration: 'none' }}>
	Tracker
</Link>
```

Match the style of the existing "Resumes" link.

- [ ] **Step 5: Verify**

Run: `npm run dev` — click Download & Track with a job selected, verify toast appears, verify application is created (check via Prisma Studio or network tab).

- [ ] **Step 6: Commit**

```bash
git add app/components/builder-nav.tsx app/routes/builder+/index.tsx
git commit -m "feat: Download & Track creates application record with toast confirmation"
```

---

## Task 13: Application Tracker Page

**Files:**
- Create: `app/routes/tracker.tsx`

- [ ] **Step 1: Read design reference**

Read `design-reference/application_tracker_final/screen.png` and `code.html` for the table layout.

- [ ] **Step 2: Create tracker.tsx**

```typescript
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, useFetcher, Link } from '@remix-run/react'
import { getUserId } from '~/utils/auth.server.ts'
import { getUserApplications } from '~/utils/application.server.ts'
import { redirect } from '@remix-run/node'
```

Loader: require auth (redirect to `/login` if no userId), call `getUserApplications(userId)`.

Page structure:
- Use existing app layout pattern (standalone page, not builder layout)
- Header: "Application Tracker" (Manrope headline, large), subtitle
- Table using inline styles matching builder design tokens
  - Import theme constants: `BRAND`, `SUCCESS`, `WARN`, `ERROR` — same constants as builder
  - Table background: `#fafafa` (light) — or use a simple theme check
  - Columns: Company (bold), Role, Match Level (colored badge), Date Applied (formatted), Status (dropdown), Actions (⋯ menu)
- Match level badge colors: strong → SUCCESS bg, moderate → BRAND bg, weak → WARN bg, mismatch → ERROR bg (white text, small rounded badge)
- Status dropdown: use a simple `<select>` styled to match (or a custom dropdown). Options: Applied, Interviewing, Offered, Rejected, No Response
- Status change: `fetcher.submit()` to `/resources/applications` with `intent: 'update-status'`
- Actions menu: "View Resume" links to `/builder` (set resume cookie), "Delete" posts to `/resources/applications` with `intent: 'delete'`
- Empty state: message + `<Link to="/builder">` button

- [ ] **Step 3: Add nav link in builder-nav.tsx if not already done**

Verify "Tracker" link was added in Task 12.

- [ ] **Step 4: Verify**

Run: `npm run dev` — navigate to `/tracker`, verify empty state. Download & Track a resume, navigate to tracker, verify row appears with correct data.

- [ ] **Step 5: Commit**

```bash
git add app/routes/tracker.tsx
git commit -m "feat: add Application Tracker page with status management"
```

---

## Task 14: Onboarding Widget Update

**Files:**
- Modify: `app/components/onboarding-widget.tsx`
- Modify: `app/utils/onboarding.ts`
- Modify: `app/hooks/use-onboarding-flow.ts`

- [ ] **Step 1: Update OnboardingStage type**

In `app/utils/onboarding.ts`, update the stage type and logic:

```typescript
export type OnboardingStage =
	| 'needs_resume'
	| 'needs_job'
	| 'needs_match_review'
	| 'needs_first_action'
	| 'complete'
```

Update `getOnboardingStage` to use the new stages. Remove `needs_bullet_tailor` and `needs_tailor_click`. The new stages (`needs_match_review`, `needs_first_action`) are session-only — the function should check the flags passed in, not server progress.

Update `getSpotlightTarget` and `getSpotlightHint` — remove old targets, the new steps don't need spotlight (they naturally happen in the Truth Panel).

- [ ] **Step 2: Update useOnboardingFlow hook**

In `app/hooks/use-onboarding-flow.ts`, add new options to the interface:

```typescript
hasReviewedMatch: boolean  // session state from builder
hasTakenAction: boolean    // session state from builder
```

Update stage computation to use these instead of `hasTailored`.

- [ ] **Step 3: Update onboarding widget step labels**

In `app/components/onboarding-widget.tsx`, update the step definitions:

```typescript
const steps = [
	{ label: 'Create a resume', done: !!(formData.name || formData.role) },
	{ label: 'Add a target job', done: !!selectedJob },
	{ label: 'Review your match', done: hasReviewedMatch },
	{ label: 'Take your first action', done: hasTakenAction },
]
```

- [ ] **Step 4: Wire new state in builder**

In `app/routes/builder+/index.tsx`, add session-only state:

```typescript
const [hasReviewedMatch, setHasReviewedMatch] = useState(false)
const [hasTakenAction, setHasTakenAction] = useState(false)
```

Set `hasReviewedMatch` to `true` when Truth Panel renders with a job selected (in the TruthPanel's useEffect or via a callback). Set `hasTakenAction` to `true` when any Best Moves button is clicked.

Pass these to the onboarding widget.

- [ ] **Step 5: Verify**

Run: `npm run dev` — check onboarding widget shows new steps, completion conditions work.

- [ ] **Step 6: Commit**

```bash
git add app/components/onboarding-widget.tsx app/utils/onboarding.ts app/hooks/use-onboarding-flow.ts app/routes/builder+/index.tsx
git commit -m "feat: update onboarding steps for Truth Panel flow"
```

---

## Task 15: Cleanup Dead Code

**Files:**
- Delete: `app/hooks/use-resume-score.ts`
- Modify: `app/routes/builder+/index.tsx` (if any remaining dead imports)

- [ ] **Step 1: Delete use-resume-score.ts**

Verify no other files import from it first:

Run grep for `use-resume-score` across the codebase. If only the builder imported it (and that import was already removed in Task 10), delete the file.

- [ ] **Step 2: Clean up any remaining dead imports in builder**

Check `app/routes/builder+/index.tsx` for unused imports: `useResumeScore`, `parseTieredKeywords`, `ChecklistItem`, `KeywordMatch`, and any lucide icons only used by removed code (`Target`, `TrendingUp`, `Zap`, `AlignLeft` — verify each is not used elsewhere in the file before removing).

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass.

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dead score system code"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Run: `npx playwright test` (if available)

- [ ] **Step 2: Manual smoke test**

1. Open builder with no job selected → Truth Panel shows empty state
2. Add a job → Truth Panel fetches and shows experience match
3. Verify match level color and summary text
4. Verify Best Moves cards render (cover_letter and referral always present for moderate/strong)
5. Click "Generate with AI" → cover letter panel opens with generated text
6. Edit cover letter → verify auto-save (check network tab for save-resume call)
7. Close cover letter panel → reopen → draft persists
8. Switch to different job → generate another cover letter → switch back → first draft still present
9. Click "Download & Track" → PDF downloads + toast shows + application created
10. Navigate to /tracker → application row appears with correct data
11. Change status in tracker → verify update
12. Delete application → verify removal
13. Check onboarding widget shows new steps and completion works
14. Toggle dark mode → verify Truth Panel and Tracker use correct theme colors

- [ ] **Step 3: Commit any fixes from smoke testing**

- [ ] **Step 4: Final commit message**

```bash
git log --oneline feature/truth-panel-redesign...main
```

Verify clean commit history telling the story: schema → extractions → server utils → AI functions → Truth Panel → Cover Letter → Download & Track → Tracker → Onboarding → Cleanup.
