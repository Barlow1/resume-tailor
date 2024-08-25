import { useLoaderData } from '@remix-run/react'
import { type DataFunctionArgs, json } from '@remix-run/server-runtime'
import { Icon } from '~/components/ui/icon.tsx'
import { ExperienceEditor } from '~/routes/resources+/experience-editor.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export const handle = {
	breadcrumb: <Icon name="pencil-2">Edit Experience</Icon>,
}

export async function loader({ request, params }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const experience = await prisma.experience.findUnique({
		where: {
			id: params.experienceId,
		},
	})
	const resume = await prisma.resume.findFirst({
		where: {
			ownerId: userId,
		},
		include: {
			experience: true,
			education: true,
			skills: true,
		},
	})
	if (!experience || !resume) {
		throw new Response('Not found', { status: 404 })
	}
	return json({ experience, resume })
}

export default function EditExperienceRoute() {
	const data = useLoaderData<typeof loader>()

	return (
		<ExperienceEditor
			experience={data.experience}
			resume={data.resume}
			redirectTo={`/gettingstarted/generate`}
		/>
	)
}
