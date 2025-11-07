import { json, type DataFunctionArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { z } from 'zod'
import { prisma } from '~/utils/db.server.ts'
import {
	requireStripeSubscription,
	requireUserId,
} from '~/utils/auth.server.ts'

export const JobEditorSchema = z.object({
	experience: z.string().min(1),
	jobTitle: z.string().min(1),
	jobDescription: z.string().min(1),
})

export const handle = {
	breadcrumb: (data: FromLoader<typeof loader>) => 'Generate',
}

export async function loader({ params, request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const gettingStartedProgress = await prisma.gettingStartedProgress.findUnique(
		{
			where: {
				ownerId: userId,
			},
		},
	)

	if (gettingStartedProgress && gettingStartedProgress?.generateCount > 1) {
		const successUrl = request.url
		const cancelUrl = request.url.split('/generate')[0]
		await requireStripeSubscription({ userId, successUrl, cancelUrl })
	}

	return json({ jobId: params.jobId })
}

export default function ResumeTailorRoute() {
	return (
		<div className="m-auto mb-36 max-w-3xl md:container">
			<main>
				<Outlet />
			</main>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: () => <p>Job not found</p>,
			}}
		/>
	)
}
