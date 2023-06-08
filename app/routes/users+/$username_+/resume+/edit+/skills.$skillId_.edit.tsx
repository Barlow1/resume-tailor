import { useLoaderData } from '@remix-run/react'
import { type DataFunctionArgs, json } from '@remix-run/server-runtime'
import { SkillEditor } from '~/routes/resources+/skill-editor.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export async function loader({ request, params }: DataFunctionArgs) {
	await requireUserId(request)
	const skill = await prisma.skill.findUnique({
		where: {
			id: params.skillId,
		},
	})
	if (!skill) {
		throw new Response('Not found', { status: 404 })
	}
	return json({ skill })
}

export default function EditSkillRoute() {
	const data = useLoaderData<typeof loader>()

	return <SkillEditor skill={data.skill} />
}
