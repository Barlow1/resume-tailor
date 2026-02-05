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
		select: { id: true },
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

	return json({ success: true })
}
