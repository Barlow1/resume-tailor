import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { generateRequirementBullets } from '~/utils/openai.server.ts'
import {
	trackAiTailorStarted,
	trackAiTailorCompleted,
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

		trackAiTailorCompleted(
			userId,
			'truth_panel_bullets',
			Date.now() - startTime,
			true,
			undefined,
			request,
			resumeId,
			jobId,
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
