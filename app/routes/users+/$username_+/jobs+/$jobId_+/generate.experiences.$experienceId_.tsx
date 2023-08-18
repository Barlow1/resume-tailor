import { json, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Icon } from '~/components/ui/icon.tsx'
import { ExperienceGenerator } from '~/routes/resources+/experience-generator.tsx'
import { prisma } from '~/utils/db.server.ts'

export const handle = {
	breadcrumb: <Icon name="pencil-2">Experience</Icon>,
}

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

	return <ExperienceGenerator experience={data.experience} job={data.job} />
}
