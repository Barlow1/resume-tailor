import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { generateRequirementBullets } from '~/utils/openai.server.ts'
import {
	trackAiTailorStarted,
	trackAiTailorCompleted,
	trackServerEvent,
	flushAnalytics,
} from '~/lib/analytics.server.ts'

export async function action({ request }: ActionFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 })

	const { resumeId, jobId, requirements, requirementExperienceMap, clientResume } = (await request.json()) as {
		resumeId: string
		jobId: string
		requirements: string[]
		requirementExperienceMap?: Record<string, string>
		clientResume?: {
			about?: string | null
			experiences?: Array<{ id?: string | null; role?: string | null; company?: string | null; startDate?: string | null; endDate?: string | null; descriptions?: Array<{ id?: string | null; content?: string | null }> }>
			education?: Array<{ id?: string | null; school?: string | null; degree?: string | null; startDate?: string | null; endDate?: string | null; description?: string | null }>
			skills?: Array<{ id?: string | null; name?: string | null }>
		}
	}

	// Verify ownership and get job description
	const [resume, job] = await Promise.all([
		prisma.builderResume.findUnique({
			where: { id: resumeId, userId },
			select: { id: true },
		}),
		prisma.job.findUnique({ where: { id: jobId, ownerId: userId } }),
	])

	if (!resume || !job) return json({ error: 'Not found' }, { status: 404 })

	// Use client-supplied resume data (has correct in-memory IDs) instead of DB
	// data (IDs regenerate on every save due to deleteMany/create pattern)
	const resumeData = clientResume ? {
		about: clientResume.about,
		experiences: (clientResume.experiences ?? []).map(e => ({
			id: e.id,
			role: e.role,
			company: e.company,
			startDate: e.startDate,
			endDate: e.endDate,
			descriptions: (e.descriptions ?? []).map(d => ({ id: d.id, content: d.content })),
		})),
		education: (clientResume.education ?? []).map(e => ({
			id: e.id,
			school: e.school,
			degree: e.degree,
			startDate: e.startDate,
			endDate: e.endDate,
			description: e.description,
		})),
		skills: (clientResume.skills ?? []).map(s => ({ id: s.id, name: s.name })),
		visibleSections: null,
	} : {
		about: null as string | null,
		experiences: [] as Array<{ id?: string | null; role?: string | null; company?: string | null; startDate?: string | null; endDate?: string | null; descriptions: Array<{ id?: string | null; content?: string | null }> }>,
		education: [] as Array<{ id?: string | null; school?: string | null; degree?: string | null; startDate?: string | null; endDate?: string | null; description?: string | null }>,
		skills: [] as Array<{ id?: string | null; name?: string | null }>,
		visibleSections: null,
	}

	const startTime = Date.now()
	trackAiTailorStarted(
		userId,
		'truth_panel_bullets',
		true,
		true,
		request,
		resumeId,
		jobId,
	)

	try {
		const result = await generateRequirementBullets({
			resumeData,
			jobDescription: job.content,
			requirements,
			requirementExperienceMap,
		})

		await prisma.gettingStartedProgress.upsert({
			where: { ownerId: userId },
			update: {
				tailorCount: { increment: 1 },
			},
			create: {
				ownerId: userId,
				hasSavedJob: false,
				hasSavedResume: false,
				hasGeneratedResume: false,
				hasTailoredResume: true,
				tailorCount: 1,
			},
		})

		const bullets = result.bullets ?? []

		try {
			// Look up by user+job only (not resumeId). The BuilderResume ID can change
			// between match and tailor (save regenerates it via deleteMany/create), so
			// filtering by resumeId here causes the lookup to miss legitimate runs.
			const triggeringRun = await prisma.experienceMatchRun.findFirst({
				where: { jobId, userId },
				orderBy: { createdAt: 'desc' },
				select: { id: true },
			})
			if (triggeringRun) {
				const fixesToLog = bullets.filter(
					b => (b.action === 'new' || b.action === 'rewrite') && b.experienceId && b.bulletText,
				)
				if (fixesToLog.length > 0) {
					await prisma.requirementFix.createMany({
						data: fixesToLog.map(b => ({
							userId,
							resumeId,
							jobId,
							experienceId: b.experienceId as string,
							triggeringRunId: triggeringRun.id,
							requirement: b.requirement,
							bulletAction: b.action,
							previousBulletContent: b.action === 'rewrite' ? b.originalText : null,
							finalBulletContent: b.bulletText as string,
						})),
					})
				}
			}
		} catch (fixErr) {
			console.error('[generate-requirement-bullets] failed to log fixes', fixErr)
		}

		const newCount = bullets.filter(b => b.action === 'new').length
		const rewriteCount = bullets.filter(b => b.action === 'rewrite').length
		const alreadyCoveredCount = 0
		const notABulletCount = bullets.filter(b => b.action === 'not_a_bullet').length
		const gapCount = bullets.filter(b => b.isGap || !b.experienceId || !b.bulletText).length
		const warningsCount = result.warnings?.length ?? 0
		const appliedCount = newCount + rewriteCount

		trackServerEvent(
			'ai_tailor_completed',
			{
				experience_id: 'truth_panel_bullets',
				duration_ms: Date.now() - startTime,
				success: true,
				resume_id: resumeId,
				job_id: jobId,
				bullet_count: appliedCount,
				gap_count: gapCount,
				already_covered_count: alreadyCoveredCount,
				warnings_count: warningsCount,
				new_count: newCount,
				rewrite_count: rewriteCount,
				not_a_bullet_count: notABulletCount,
				requirements_requested: requirements.length,
			},
			{ userId, request },
		)
		await flushAnalytics()

		return json({ bullets: result.bullets, summary: result.summary, warnings: result.warnings })
	} catch (err) {
		console.error('generate-requirement-bullets error:', err)
		trackAiTailorCompleted(
			userId,
			'truth_panel_bullets',
			Date.now() - startTime,
			false,
			undefined,
			request,
			resumeId,
			jobId,
		)
		await flushAnalytics()
		return json({ error: 'Failed to generate bullets' }, { status: 500 })
	}
}
