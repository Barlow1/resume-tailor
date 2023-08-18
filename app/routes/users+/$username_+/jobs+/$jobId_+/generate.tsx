import { json, type DataFunctionArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { z } from 'zod'
import Breadcrumbs from '~/components/ui/breadcrumbs.tsx'
import { Spacer } from '~/components/spacer.tsx'
import { useUser } from '~/utils/user.ts'

export const JobEditorSchema = z.object({
	experience: z.string().min(1),
	jobTitle: z.string().min(1),
	jobDescription: z.string().min(1),
})

export async function loader({ params }: DataFunctionArgs) {
	return json({ jobId: params.jobId })
}

export default function ResumeTailorRoute() {
	const user = useUser()
	const data = useLoaderData<typeof loader>()

	return (
		<div className="container m-auto mb-36 max-w-3xl">
			<Breadcrumbs
				origin={{
					breadcrumb: 'Generate',
					pathname: `/users/${user.username}/jobs/${data.jobId}/generate`,
				}}
			/>
			<Spacer size="xs" />
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
