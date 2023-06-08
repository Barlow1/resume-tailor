import { Outlet, useLoaderData } from '@remix-run/react'
import { json, type DataFunctionArgs } from '@remix-run/server-runtime'
import { ResumeEditor } from '~/routes/resources+/resume-editor.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export async function loader({ request }: DataFunctionArgs) {
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

export default function EditResumeRoute() {
	const data = useLoaderData<typeof loader>()

	return (
		<>
			<ResumeEditor resume={data.resume} />
			<Outlet />
		</>
	)
}
