import { json, type DataFunctionArgs } from '@remix-run/node'
import { authenticator, requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { OpenAI } from 'openai'
import { type ResumeData } from '~/utils/builder-resume.server.ts'
import {
	trackAiTailorStarted,
	trackAiTailorCompleted,
	trackError,
} from '~/lib/analytics.server.ts'
import { trackUserActivity } from '~/lib/retention.server.ts'

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY ?? 'test-key',
})

/* ═══ HELPERS ═══ */

function formatResumeForPrompt(data: ResumeData): string {
	const lines: string[] = []

	if (data.name) lines.push(`# ${data.name}`)
	if (data.role) lines.push(`**${data.role}**`)
	if (data.about) lines.push(`\n## Summary\n${data.about}`)

	if (data.experiences?.length) {
		lines.push('\n## Experience')
		for (const exp of data.experiences) {
			const dateRange = [exp.startDate, exp.endDate]
				.filter(Boolean)
				.join(' – ')
			lines.push(
				`\n### ${exp.role || 'Role'} at ${exp.company || 'Company'}${dateRange ? ` (${dateRange})` : ''} [id: ${exp.id}]`,
			)
			if (exp.descriptions?.length) {
				exp.descriptions.forEach((d, i) => {
					if (d.content?.trim()) {
						lines.push(`  - [bullet ${i}] ${d.content}`)
					}
				})
			}
		}
	}

	if (data.skills?.length) {
		const skillNames = data.skills
			.map(s => s.name)
			.filter(Boolean)
			.join(', ')
		if (skillNames) lines.push(`\n## Skills\n${skillNames}`)
	}

	if (data.education?.length) {
		lines.push('\n## Education')
		for (const edu of data.education) {
			const parts = [edu.degree, edu.school].filter(Boolean).join(' — ')
			if (parts) lines.push(`- ${parts}`)
		}
	}

	return lines.join('\n')
}

function tryParseJSON<T>(text: string, validator: (obj: Record<string, unknown>) => boolean): T | null {
	let cleaned = text.trim()
	if (cleaned.startsWith('```')) {
		cleaned = cleaned
			.replace(/^```(?:json)?\s*\n?/, '')
			.replace(/\n?```\s*$/, '')
	}
	try {
		const parsed = JSON.parse(cleaned) as Record<string, unknown>
		return validator(parsed) ? (parsed as unknown as T) : null
	} catch {
		return null
	}
}

function handleApiError(
	error: any,
	userId: string,
	startTime: number,
	phase: string,
	request: Request,
) {
	trackAiTailorCompleted(userId, phase, Date.now() - startTime, false, undefined, request)
	trackError(error.message, phase, userId, error.stack, request)

	if (error.message?.includes('rate_limit') || error.code === 'rate_limit_exceeded') {
		return json(
			{ error: 'Our AI is currently busy. Please try again in 30 seconds.' },
			{ status: 429 },
		)
	}
	if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
		return json({ error: 'Request timed out. Please try again.' }, { status: 504 })
	}
	return json({ error: 'Failed to analyze. Please try again.' }, { status: 500 })
}

/* ═══ PROMPTS (split into two focused calls) ═══ */

const REQUIREMENTS_SYSTEM = `You are a resume analysis expert. Given a resume and job description, extract the key requirements and map how well the resume matches.

Return ONLY valid JSON. No markdown fences, no explanation.`

const CHANGES_SYSTEM = `You are a resume tailoring expert. Given a resume and job description, generate specific changes to better align the resume with the role.

CRITICAL RULES:
- KEEP the user's specific numbers, metrics, and facts — never invent data
- Use the employer's exact terminology where it maps to real experience
- Reference experience IDs [id: xxx] and bullet indices [bullet N] from the annotations
- For bullet rewrites: targetExpId = experience ID, targetBulletIndex = bullet index
- For new bullets: isAddition=true, targetExpId = most relevant experience
- For skills: section="Skills"
- For summary: section="Summary"

Return ONLY valid JSON. No markdown fences, no explanation.`

/* ═══ ACTION ═══ */

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request, { redirectTo: '/builder' })

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, username: true },
	})
	if (!user) {
		await authenticator.logout(request, { redirectTo: '/' })
		return new Response(null, { status: 401 })
	}

	const formData = await request.formData()
	const resumeDataRaw = formData.get('resumeData') as string
	const jobContent = formData.get('jobContent') as string
	const jobTitle = (formData.get('jobTitle') as string) || ''
	const company = (formData.get('company') as string) || ''
	const phase = (formData.get('phase') as string) || 'all'

	if (!resumeDataRaw || !jobContent) {
		return json({ error: 'Missing resume data or job description.' }, { status: 400 })
	}

	const parsedResume = JSON.parse(resumeDataRaw) as ResumeData
	const resumeText = formatResumeForPrompt(parsedResume)
	const startTime = Date.now()

	const resumeAndJob = `## Resume\n${resumeText}\n\n## Job Description\nTitle: ${jobTitle}\nCompany: ${company}\n\n${jobContent}`

	/* ── Phase: requirements only (fast — smaller output) ── */
	if (phase === 'requirements') {
		trackAiTailorStarted(userId, 'job_fit_requirements', !!parsedResume.jobId, true, request, parsedResume.id ?? undefined, parsedResume.jobId ?? undefined)

		const userPrompt = `${resumeAndJob}

## Instructions
Extract 8-15 requirements from the job description. For each, find the best matching resume bullet.

Return a JSON object:
{
  "requirements": [
    { "id": "r1", "category": "Technical"|"Leadership"|"Impact"|"Culture", "requirement": "...", "matchType": "strong"|"partial"|"gap", "matchedBullet": "..."|null, "matchedExpId": "..."|null, "matchSource": "..."|null }
  ],
  "jobTitle": "...",
  "company": "..."
}

Return ONLY the JSON object.`

		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const response = await openai.chat.completions.create({
					model: 'gpt-5.2',
					messages: [
						{ role: 'system', content: REQUIREMENTS_SYSTEM },
						{
							role: 'user',
							content: attempt > 0
								? userPrompt + '\n\nIMPORTANT: Return ONLY valid JSON.'
								: userPrompt,
						},
					],
					temperature: 0.4,
					max_completion_tokens: 4096,
				})

				const content = response.choices[0]?.message?.content
				if (!content) continue

				type ReqResponse = { requirements: any[]; jobTitle: string; company: string }
				const parsed = tryParseJSON<ReqResponse>(content, o => Array.isArray(o.requirements))
				if (!parsed) continue

				const total = parsed.requirements.length
				const strong = parsed.requirements.filter((r: any) => r.matchType === 'strong').length
				const partial = parsed.requirements.filter((r: any) => r.matchType === 'partial').length
				const matchScore = total > 0 ? Math.round(((strong + partial * 0.5) / total) * 100) : 0

				trackAiTailorCompleted(userId, 'job_fit_requirements', Date.now() - startTime, true, undefined, request, parsedResume.id ?? undefined, parsedResume.jobId ?? undefined)

				return json({
					phase: 'requirements',
					requirements: parsed.requirements,
					jobTitle: parsed.jobTitle || jobTitle,
					company: parsed.company || company,
					matchScore,
				})
			} catch (error: any) {
				if (attempt === 1) return handleApiError(error, userId, startTime, 'job_fit_requirements', request)
			}
		}
		return json({ error: 'Failed to extract requirements.' }, { status: 500 })
	}

	/* ── Phase: changes only (heavier — more output tokens) ── */
	if (phase === 'changes') {
		trackAiTailorStarted(userId, 'job_fit_changes', !!parsedResume.jobId, true, request, parsedResume.id ?? undefined, parsedResume.jobId ?? undefined)

		const userPrompt = `${resumeAndJob}

## Instructions
Generate 6-15 tailoring changes to better align this resume with the job. Include:
- Rewrites for existing bullets that could better match requirements
- New bullets for experience gaps (isAddition: true)
- Skills additions if needed
- Summary rewrite if it doesn't reflect the target role

Return a JSON object:
{
  "changes": [
    { "id": "c1", "section": "Summary"|"Experience"|"Skills", "targetExpId": "..."|null, "targetBulletIndex": 0|null, "original": "..."|null, "reason": "...", "suggested": "...", "isAddition": false|true }
  ]
}

Return ONLY the JSON object.`

		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const response = await openai.chat.completions.create({
					model: 'gpt-5.2',
					messages: [
						{ role: 'system', content: CHANGES_SYSTEM },
						{
							role: 'user',
							content: attempt > 0
								? userPrompt + '\n\nIMPORTANT: Return ONLY valid JSON.'
								: userPrompt,
						},
					],
					temperature: 0.45,
					max_completion_tokens: 6144,
				})

				const content = response.choices[0]?.message?.content
				if (!content) continue

				type ChangesResponse = { changes: any[] }
				const parsed = tryParseJSON<ChangesResponse>(content, o => Array.isArray(o.changes))
				if (!parsed) continue

				const changes = parsed.changes.map((ch: any) => ({
					...ch,
					status: 'pending' as const,
				}))

				trackAiTailorCompleted(userId, 'job_fit_changes', Date.now() - startTime, true, undefined, request, parsedResume.id ?? undefined, parsedResume.jobId ?? undefined)
				await trackUserActivity({ userId, trigger: 'ai_tailor', request })

				return json({ phase: 'changes', changes })
			} catch (error: any) {
				if (attempt === 1) return handleApiError(error, userId, startTime, 'job_fit_changes', request)
			}
		}
		return json({ error: 'Failed to generate changes.' }, { status: 500 })
	}

	/* ── Fallback: both phases in one call (legacy) ── */
	trackAiTailorStarted(userId, 'job_fit_analysis', !!parsedResume.jobId, true, request, parsedResume.id ?? undefined, parsedResume.jobId ?? undefined)

	const userPrompt = `${resumeAndJob}

## Instructions
Analyze the resume against this job description. Return a JSON object with:
- "requirements": array of 8-15 requirements extracted from the JD
- "changes": array of 6-15 tailoring changes
- "jobTitle": the job title
- "company": the company name

Each requirement: { id (string), category ("Technical"|"Leadership"|"Impact"|"Culture"), requirement (string), matchType ("strong"|"partial"|"gap"), matchedBullet (string|null), matchedExpId (string|null), matchSource (string|null) }

Each change: { id (string), section ("Summary"|"Experience"|"Skills"), targetExpId (string|null), targetBulletIndex (number|null), original (string|null), reason (string), suggested (string), isAddition (boolean) }

Return ONLY the JSON object.`

	const COMBINED_SYSTEM = `You are a resume tailoring expert. Given a resume and job description, you will:
1. Extract 8-15 requirements from the JD, categorized as Technical, Leadership, Impact, or Culture.
2. For each requirement, find the best matching bullet and classify as strong/partial/gap.
3. Generate 6-15 tailoring changes.

CRITICAL RULES:
- KEEP the user's specific numbers, metrics, and facts — never invent data
- Use the employer's exact terminology where it maps to real experience
- Reference experience IDs [id: xxx] and bullet indices [bullet N]
- Return ONLY valid JSON. No markdown fences, no explanation.`

	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const response = await openai.chat.completions.create({
				model: 'gpt-5.2',
				messages: [
					{ role: 'system', content: COMBINED_SYSTEM },
					{
						role: 'user',
						content: attempt > 0
							? userPrompt + '\n\nIMPORTANT: Return ONLY valid JSON.'
							: userPrompt,
					},
				],
				temperature: 0.45,
				max_completion_tokens: 8192,
			})

			const content = response.choices[0]?.message?.content
			if (!content) continue

			type FullResponse = { requirements: any[]; changes: any[]; jobTitle: string; company: string }
			const parsed = tryParseJSON<FullResponse>(content, o => Array.isArray(o.requirements) && Array.isArray(o.changes))
			if (!parsed) continue

			const total = parsed.requirements.length
			const strong = parsed.requirements.filter((r: any) => r.matchType === 'strong').length
			const partial = parsed.requirements.filter((r: any) => r.matchType === 'partial').length
			const matchScore = total > 0 ? Math.round(((strong + partial * 0.5) / total) * 100) : 0
			const changes = parsed.changes.map((ch: any) => ({ ...ch, status: 'pending' as const }))

			trackAiTailorCompleted(userId, 'job_fit_analysis', Date.now() - startTime, true, undefined, request, parsedResume.id ?? undefined, parsedResume.jobId ?? undefined)
			await trackUserActivity({ userId, trigger: 'ai_tailor', request })

			return json({
				requirements: parsed.requirements,
				changes,
				jobTitle: parsed.jobTitle || jobTitle,
				company: parsed.company || company,
				matchScore,
			})
		} catch (error: any) {
			if (attempt === 2) return handleApiError(error, userId, startTime, 'job_fit_analysis', request)
		}
	}

	return json({ error: 'Failed to analyze job fit.' }, { status: 500 })
}
