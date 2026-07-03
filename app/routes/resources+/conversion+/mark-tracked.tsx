import { type DataFunctionArgs, json } from '@remix-run/node'
import { prisma } from '~/utils/db.server.ts'
import { invariant } from '~/utils/misc.ts'

interface MarkTrackedRequest {
	conversionEventId: string
}

export async function action({ request }: DataFunctionArgs) {
	if (request.method !== 'POST') {
		return json({ error: 'Method not allowed' }, { status: 405 })
	}

	const body = (await request.json()) as MarkTrackedRequest
	const { conversionEventId } = body

	invariant(conversionEventId, 'conversionEventId is required')

	try {
		// Mark the conversion event as tracked
		await prisma.conversionEvent.update({
			where: {
				id: conversionEventId,
			},
			data: {
				tracked: true,
			},
		})

		return json({ success: true })
	} catch (e) {
		return json({ error: 'Failed to mark event as tracked' }, { status: 500 })
	}
}
