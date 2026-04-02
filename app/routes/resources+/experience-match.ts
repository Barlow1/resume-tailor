import { json, type ActionFunctionArgs } from '@remix-run/node'
import { createHash } from 'crypto'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { getExperienceMatch } from '~/utils/openai.server.ts'
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
		prisma.job.findUnique({ where: { id: jobId, ownerId: userId } }),
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

	const result = await getExperienceMatch({ resumeData, jobDescription: job.content })

	await prisma.experienceMatchCache.upsert({
		where: { resumeId_jobId: { resumeId, jobId } },
		create: { resumeId, jobId, resumeHash, jobHash, resultJson: JSON.stringify(result) },
		update: { resumeHash, jobHash, resultJson: JSON.stringify(result) },
	})

	return json(result)
}
