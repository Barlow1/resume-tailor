import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { Link,  useLoaderData, useNavigate } from '@remix-run/react'
import { requireUserId } from '~/utils/auth.server.ts'
import { getUserJobs } from '~/utils/job.server.ts'
import { Button } from '~/components/ui/button.tsx'
import { Icon } from '~/components/ui/icon.tsx'
import { CreateJobModal } from '~/components/create-job-modal.tsx'
import { useCallback, useState } from 'react'
import { type Job } from '@prisma/client'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const jobs = await getUserJobs(userId)
	return json({ jobs, userId })
}

export default function JobsPage() {
	const { jobs, userId } = useLoaderData<typeof loader>()
	const [showCreateJob, setShowCreateJob] = useState(false)
	const navigate = useNavigate()

	const onCreate = useCallback((job: Jsonify<Job>) => {
		navigate(`/users/${userId}/jobs/${job.id}`)
			}, [navigate, userId])

	const onClose = useCallback(() => {
		setShowCreateJob(false)
	}, [setShowCreateJob])

	return (
		<div className="container mx-auto py-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">My Jobs</h1>
				<Button 
					onClick={() => setShowCreateJob(true)} 
					className="flex items-center gap-2"
				>
					<Icon name="plus" size="sm" />
					Add New Job
				</Button>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{jobs.map(job => (
					<Link
						key={job.id}
						to={`/users/${userId}/jobs/${job.id}`}
						className="group relative flex flex-col rounded-lg border border-gray-200 p-4 transition hover:border-gray-300 hover:shadow-md"
					>
						<h2 className="mb-2 font-semibold">
							{job.title}
						</h2>
						<p className="text-sm text-gray-500 line-clamp-2">
							{job.content}
						</p>
						<div className="mt-4 text-sm text-gray-400">
							<span>
								Created: {new Date(job.createdAt).toLocaleDateString()}
							</span>
						</div>
						<Icon
							size="md"
							name="arrow-right"
							className="absolute bottom-4 right-4 opacity-0 transition group-hover:opacity-100"
						/>
					</Link>
				))}

				{jobs.length === 0 && (
					<div className="col-span-full rounded-lg border border-dashed border-gray-200 p-8 text-center">
						<p className="text-gray-500">
							You haven't added any jobs yet.
						</p>
						<Button 
							onClick={() => setShowCreateJob(true)}
							className="mt-4"
						>
							Add your first job
						</Button>
					</div>
				)}
			</div>

			<CreateJobModal
				isOpen={showCreateJob}
				onClose={onClose}
				onCreate={onCreate}
			/>
		</div>
	)
} 