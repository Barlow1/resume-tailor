import { type DataFunctionArgs, json } from '@remix-run/node'
import { PrismaClient } from '@prisma/client'
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

	const prisma = new PrismaClient()
	try {
		await prisma.$connect()

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
		console.error('Error marking conversion event as tracked', e)
		return json({ error: 'Failed to mark event as tracked' }, { status: 500 })
	} finally {
		await prisma.$disconnect()
	}
}
