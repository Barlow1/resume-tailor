import { json, type DataFunctionArgs } from '@remix-run/node'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request, { redirectTo: '/builder' })

	const formData = await request.formData()
	const logId = formData.get('logId')
	const action = formData.get('action')
	const selectedOption = formData.get('selectedOption')

	if (typeof logId !== 'string' || typeof action !== 'string') {
		return json({ error: 'Missing logId or action' }, { status: 400 })
	}

	// Verify the log belongs to this user
	const log = await prisma.bulletTailorLog.findFirst({
		where: { id: logId, userId },
	})

	if (!log) {
		return json({ error: 'Log not found' }, { status: 404 })
	}

	await prisma.bulletTailorLog.update({
		where: { id: logId },
		data: {
			userAction: action,
			selectedOption:
				typeof selectedOption === 'string'
					? parseInt(selectedOption, 10)
					: null,
			actionAt: new Date(),
		},
	})

	// Fire webhook to n8n for real-time AI quality analysis
	const webhookUrl = process.env.N8N_WEBHOOK_URL
	if (webhookUrl) {
		fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				originalBullet: log.originalBullet,
				aiOutput: log.aiOutput,
				jobTitle: log.jobTitle,
				jobDescription: log.jobDescription,
				userAction: action,
				selectedOption: selectedOption ?? null,
				userId,
				timestamp: new Date().toISOString(),
			}),
		}).catch(() => {}) // fire-and-forget, don't block the user
	}

	return json({ success: true })
}
