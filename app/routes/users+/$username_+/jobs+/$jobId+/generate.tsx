import { json, type DataFunctionArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { z } from 'zod'
import { prisma } from '~/utils/db.server.ts'
import { requireUserId } from '~/utils/auth.server.ts'
import React from 'react'
import { trackEvent } from '~/utils/analytics.ts'
import { SubscribeModal } from '~/components/subscribe-modal.tsx'

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
			select: {
				tailorCount: true,
				generateCount: true,
				analysisCount: true,
			},
		},
	)

	// Check if user has hit paywall
	if (gettingStartedProgress && gettingStartedProgress?.generateCount > 3) {
		// Check if user has active subscription
		const subscription = await prisma.subscription.findFirst({
			where: { ownerId: userId, active: true },
			select: { id: true },
		})

		// If no subscription, return paywall flag instead of redirecting
		if (!subscription) {
			const totalActions =
				(gettingStartedProgress?.tailorCount || 0) +
				(gettingStartedProgress?.generateCount || 0) +
				(gettingStartedProgress?.analysisCount || 0)

			return json({
				jobId: params.jobId,
				paywallRequired: true,
				trackingData: {
					user_id: userId,
					plan_type: 'free',
					actions_remaining: Math.max(0, 4 - totalActions),
					blocked_feature: 'resume_generation',
				},
				successUrl: request.url,
				cancelUrl: request.url.split('/generate')[0],
				redirectTo: request.url,
			})
		}
	}

	return json({
		jobId: params.jobId,
		paywallRequired: false,
		trackingData: undefined,
		successUrl: undefined,
		cancelUrl: undefined,
		redirectTo: undefined,
	})
}

export default function ResumeTailorRoute() {
	const data = useLoaderData<typeof loader>()
	const [showSubscribe, setShowSubscribe] = React.useState(false)

	// Track paywall_hit event when paywall is required
	React.useEffect(() => {
		if (data.paywallRequired && 'trackingData' in data && data.trackingData) {
			trackEvent('paywall_hit', {
				user_id: data.trackingData.user_id,
				plan_type: data.trackingData.plan_type,
				actions_remaining: data.trackingData.actions_remaining,
				blocked_feature: data.trackingData.blocked_feature,
			})
			setShowSubscribe(true)
		}
	}, [data.paywallRequired, data])

	return (
		<div className="m-auto mb-36 max-w-3xl md:container">
			<main>
				<Outlet />
			</main>
			{data.paywallRequired &&
				'successUrl' in data &&
				data.successUrl &&
				'cancelUrl' in data &&
				data.cancelUrl && (
					<SubscribeModal
						isOpen={showSubscribe}
						onClose={() => setShowSubscribe(false)}
						successUrl={data.successUrl}
						cancelUrl={data.cancelUrl}
						redirectTo={data.redirectTo}
					/>
				)}
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
