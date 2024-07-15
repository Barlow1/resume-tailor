import { json, type DataFunctionArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { z } from 'zod'

export const handle = {
	breadcrumb: (data: FromLoader<typeof loader>) => data.job.title,
}

export const JobEditorSchema = z.object({
	experience: z.string().min(1),
	jobTitle: z.string().min(1),
	jobDescription: z.string().min(1),
})

export async function loader({ request, params }: DataFunctionArgs) {
	const userId = await getUserId(request)
	const job = await prisma.job.findUnique({
		where: {
			id: params.jobId,
		},
		select: {
			id: true,
			title: true,
			content: true,
			ownerId: true,
		},
	})
	const resume = await prisma.resume.findFirst({
		where: {
			ownerId: userId ?? undefined,
		},
	})
	if (!job) {
		throw new Response('Not found', { status: 404 })
	}
	return json({ job, isOwner: userId === job.ownerId, resume })
}

export default function JobIdRoute() {

	return (
		<div className="md:container m-auto mb-36 max-w-3xl">
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
