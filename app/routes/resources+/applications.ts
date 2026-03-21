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

	const body = (await request.json()) as Record<string, string>
	const intent = body.intent

	if (intent === 'create') {
		const { resumeId, jobId, matchLevel, matchSummary } = body

		const resume = await prisma.builderResume.findUnique({
			where: { id: resumeId, userId },
			select: { coverLetterDrafts: true },
		})
		let coverLetter: string | null = null
		if (resume?.coverLetterDrafts) {
			try {
				const drafts = JSON.parse(resume.coverLetterDrafts) as Record<string, string>
				coverLetter = drafts[jobId] ?? null
			} catch { /* ignore parse errors */ }
		}

		const app = await createApplication(userId, resumeId, jobId, matchLevel, matchSummary ?? null, coverLetter)
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
