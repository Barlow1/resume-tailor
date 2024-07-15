import { json, type DataFunctionArgs } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import React from 'react'
import { Spacer } from '~/components/spacer.tsx'
import Breadcrumbs from '~/components/ui/breadcrumbs.tsx'
import { Icon } from '~/components/ui/icon.tsx'
import { authenticator, requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { useUser } from '~/utils/user.ts'

export const handle = {
	breadcrumb: <Icon name="file-text">Edit Profile</Icon>,
}

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

export default function ProfileIndex() {
	const user = useUser()

	return (
		<div className="md:container m-auto mb-36 mt-16 max-w-3xl">
			<Breadcrumbs
				origin={{
					breadcrumb: 'Profile',
					pathname: `/users/${user.username}`,
				}}
			/>
			<Spacer size="xs" />
			<main>
				<Outlet />
			</main>
		</div>
	)
}
