import { useLoaderData } from '@remix-run/react'
import { DataFunctionArgs, json } from '@remix-run/server-runtime'
import { EducationEditor } from '~/routes/resources+/education-editor.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export async function loader({ request, params }: DataFunctionArgs) {
	await requireUserId(request)
	const education = await prisma.education.findUnique({
		where: {
			id: params.educationId,
		},
	})

	if (!education) {
		throw new Response('Not found', { status: 404 })
	}
	return json({ education })
}

export default function EditEducationRoute() {
	const data = useLoaderData<typeof loader>()
	
	return <EducationEditor education={data.education} />
}
