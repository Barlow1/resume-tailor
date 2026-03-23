import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { generateRequirementBullets } from '~/utils/openai.server.ts'

export async function action({ request }: ActionFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 })

	const { resumeId, jobId, requirements, requirementExperienceMap } = (await request.json()) as {
		resumeId: string
		jobId: string
		requirements: string[]
		requirementExperienceMap?: Record<string, string>
	}

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

	try {
		const result = await generateRequirementBullets({
			resumeData,
			jobDescription: job.content,
			requirements,
			requirementExperienceMap,
		})

		return json({ bullets: result.bullets, summary: result.summary, warnings: result.warnings })
	} catch (err) {
		console.error('generate-requirement-bullets error:', err)
		return json({ error: 'Failed to generate bullets', details: String(err) }, { status: 500 })
	}
}
