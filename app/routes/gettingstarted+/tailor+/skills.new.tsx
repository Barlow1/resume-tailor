import { Icon } from '~/components/ui/icon.tsx'
import { SkillEditor } from '~/routes/resources+/skill-editor.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { useLoaderData } from '@remix-run/react'
import { prisma } from '~/utils/db.server.ts'
import { type DataFunctionArgs, json } from '@remix-run/node'

export const handle = {
	breadcrumb: <Icon name="plus">Add Skill</Icon>,
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

export default function EditSkillRoute() {
	const data = useLoaderData<typeof loader>()
	return <SkillEditor resume={data.resume} redirectTo="/gettingstarted/tailor" />
}
