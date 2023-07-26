import { json, type DataFunctionArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import React from 'react'
import { Spacer } from '~/components/spacer.tsx'
import Breadcrumbs from '~/components/ui/breadcrumbs.tsx'
import { authenticator, requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { useUser } from '~/utils/user.ts'

export async function loader({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			username: true,
		},
	})
	if (!user) {
		throw await authenticator.logout(request, { redirectTo: '/' })
	}
	return json({})
}

export default function EditResume() {
	const user = useUser()

	return (
		<div className="container m-auto mb-36 max-w-3xl">
			<Breadcrumbs
				origin={{
					breadcrumb: 'Edit',
					pathname: `/users/${user.username}/resume/edit`,
				}}
			/>
			<Spacer size="xs" />
			<main>
				<Outlet />
			</main>
		</div>
	)
}
