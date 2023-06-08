import { useLoaderData } from '@remix-run/react'
import { type DataFunctionArgs, json } from '@remix-run/server-runtime'
import { ExperienceEditor } from '~/routes/resources+/experience-editor.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export async function loader({ request, params }: DataFunctionArgs) {
	await requireUserId(request)
	const experience = await prisma.experience.findUnique({
		where: {
			id: params.experienceId,
		},
	})
	if (!experience) {
		throw new Response('Not found', { status: 404 })
	}
	return json({ experience })
}

export default function EditExperienceRoute() {
	const data = useLoaderData<typeof loader>()
	
	return <ExperienceEditor experience={data.experience} />
}
