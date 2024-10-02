import { redirect, type DataFunctionArgs } from '@remix-run/node'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export const ROUTE_PATH = '/resources/delete-profile'

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request, { redirectTo: null })

	await prisma.user.delete({
		where: { id: userId },
	})

	return redirect('/')
}
