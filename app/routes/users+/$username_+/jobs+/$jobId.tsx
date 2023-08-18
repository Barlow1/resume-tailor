import { json, type DataFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { DeleteJob } from '~/routes/resources+/delete-job.tsx'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { z } from 'zod'
import { useUser } from '~/utils/user.ts'
import { Button } from '~/components/ui/button.tsx'

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
	const data = useLoaderData<typeof loader>()
	const user = useUser()

	return (
		<div className="flex h-full flex-col">
			<div className="flex-grow">
				<h2 className="mb-2 text-h2 lg:mb-6">{data.job.title}</h2>
				<p className="text-sm md:text-lg">{data.job.content}</p>
			</div>
			{data.isOwner ? (
				<div className="flex justify-end gap-4 py-5">
					<input hidden name="jobTitle" value={data.job.title} />
					<input hidden name="jobDescription" value={data.job.content} />
					<Button asChild>
						<Link
							to={
								data.resume ? 'generate' : `/users/${user.username}/resume/upload`
							}
						>
							Generate Experience
						</Link>
					</Button>
					<Button asChild>
						<Link
							to={
								data.resume ? 'tailor' : `/users/${user.username}/resume/upload`
							}
						>
							Tailor Resume
						</Link>
					</Button>
					<Button variant="secondary" asChild>
						<Link to="edit">Edit</Link>
					</Button>
					<DeleteJob id={data.job.id} />
				</div>
			) : null}
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
