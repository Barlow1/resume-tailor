import { type DataFunctionArgs, json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Icon } from '~/components/ui/icon.tsx'
import { ExperienceEditor } from '~/routes/resources+/experience-editor.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
export const handle = {
	breadcrumb: <Icon name="plus">Add Experience</Icon>,
}

export async function loader({ request, params }: DataFunctionArgs) {
	const userId = await requireUserId(request)
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
	if (!resume) {
		throw new Response('Not found', { status: 404 })
	}
	return json({ resume })
}

export default function NewExperienceRoute() {
	const data = useLoaderData<typeof loader>()

	return <ExperienceEditor resume={data.resume} redirectTo={`/gettingstarted/tailor`} />
}
