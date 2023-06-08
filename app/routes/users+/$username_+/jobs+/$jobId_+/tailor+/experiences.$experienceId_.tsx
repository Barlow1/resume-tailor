import { json, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { ExperienceTailor } from '~/routes/resources+/experience-tailor.tsx'
import { prisma } from '~/utils/db.server.ts'

export async function loader({ params }: DataFunctionArgs) {
	const experience = await prisma.experience.findUnique({
		where: {
			id: params.experienceId,
		},
	})
	const job = await prisma.job.findUnique({
		where: {
			id: params.jobId,
		},
	})
	if (!job) {
		throw new Response('Not found', { status: 404 })
	}
	if (!experience) {
		throw new Response('Not found', { status: 404 })
	}
	return json({ experience, job })
}

export default function JobEdit() {
	const data = useLoaderData<typeof loader>()

	return <ExperienceTailor experience={data.experience} job={data.job} />
}
