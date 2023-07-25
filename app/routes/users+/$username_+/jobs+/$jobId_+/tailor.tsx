import { json, type DataFunctionArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { z } from 'zod'
import { parse } from '@conform-to/zod'
import { ResumeTailor } from '~/routes/resources+/resume-tailor.tsx'

export const JobEditorSchema = z.object({
	experience: z.string().min(1),
	jobTitle: z.string().min(1),
	jobDescription: z.string().min(1),
})

export async function loader({ request, params }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const job = await prisma.job.findUnique({
		where: {
			id: params.jobId,
		},
	})
	const resume = await prisma.resume.findFirst({
		where: {
			ownerId: userId,
		},
		include: {
			skills: true,
			experience: true,
			education: true,
		},
	})
	if (!job) {
		throw new Response('Not found', { status: 404 })
	}
	if (!resume) {
		throw new Response('No resume found', { status: 404 })
	}
	return json({ job, resume, isOwner: userId === job.ownerId })
}

export default function ResumeTailorRoute() {
	const data = useLoaderData<typeof loader>()

	return (
		<>
			<h2 className="mb-2 text-h2 lg:mb-6">{data.job.title}</h2>
			<ResumeTailor resume={data.resume} job={data.job} />
			<Outlet />
		</>
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
