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

	return json({ coverLetter: text })
}
