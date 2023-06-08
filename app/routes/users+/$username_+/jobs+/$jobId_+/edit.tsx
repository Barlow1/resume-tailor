import { json, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { JobEditor } from '~/routes/resources+/job-editor.tsx'
import { prisma } from '~/utils/db.server.ts'

export async function loader({ params }: DataFunctionArgs) {
	const job = await prisma.job.findUnique({
		where: {
			id: params.jobId,
		},
	})
	if (!job) {
		throw new Response('Not found', { status: 404 })
	}
	return json({ job: job })
}

export default function JobEdit() {
	const data = useLoaderData<typeof loader>()

	return <JobEditor job={data.job} />
}
