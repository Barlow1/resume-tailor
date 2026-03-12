import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export async function action({ request }: ActionFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 })
	}

	const formData = await request.formData()
	const intent = formData.get('intent') as string
	const resumeId = formData.get('resumeId') as string

	if (!resumeId) {
		return json({ error: 'Resume ID is required' }, { status: 400 })
	}

	// Verify the resume belongs to this user
	const resume = await prisma.builderResume.findFirst({
		where: { id: resumeId, userId },
		select: { id: true, tailorSnapshot: true },
	})

	if (!resume) {
		return json({ error: 'Resume not found' }, { status: 404 })
	}

	if (intent === 'save') {
		const snapshotData = formData.get('snapshotData') as string
		if (!snapshotData) {
			return json(
				{ error: 'Snapshot data is required' },
				{ status: 400 },
			)
		}

		await prisma.builderResume.update({
			where: { id: resumeId },
			data: {
				tailorSnapshot: snapshotData,
				tailorSnapshotDate: new Date(),
			},
		})

		return json({ success: true })
	}

	if (intent === 'undo') {
		if (!resume.tailorSnapshot) {
			return json(
				{ error: 'No snapshot to restore' },
				{ status: 400 },
			)
		}

		const snapshot = resume.tailorSnapshot

		await prisma.builderResume.update({
			where: { id: resumeId },
			data: {
				tailorSnapshot: null,
				tailorSnapshotDate: null,
			},
		})

		return json({ success: true, snapshot })
	}

	if (intent === 'check') {
		return json({ hasSnapshot: !!resume.tailorSnapshot })
	}

	return json({ error: 'Invalid intent' }, { status: 400 })
}
