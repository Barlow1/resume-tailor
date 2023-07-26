import {
	json,
	type DataFunctionArgs,
	type V2_MetaFunction,
} from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { Spacer } from '~/components/spacer.tsx'
import { Button } from '~/components/ui/button.tsx'
import { prisma } from '~/utils/db.server.ts'
import { getUserImgSrc, invariant } from '~/utils/misc.ts'
import { useOptionalUser } from '~/utils/user.ts'

export async function loader({ params }: DataFunctionArgs) {
	invariant(params.username, 'Missing username')
	const user = await prisma.user.findUnique({
		where: { username: params.username },
		select: {
			id: true,
			username: true,
			name: true,
			imageId: true,
			createdAt: true,
		},
	})
	if (!user) {
		throw new Response('not found', { status: 404 })
	}
	return json({ user, userJoinedDisplay: user.createdAt.toLocaleDateString() })
}

export default function UsernameIndex() {
	const data = useLoaderData<typeof loader>()
	const user = data.user
	const userDisplayName = user.name ?? user.username
	const loggedInUser = useOptionalUser()
	const isLoggedInUser = data.user.id === loggedInUser?.id

	return (
		<div className="container mx-auto mb-48 mt-36 flex flex-col items-center justify-center">
			<Spacer size="4xs" />

			<div className="bg-night-500 container mx-auto flex flex-col items-center rounded-3xl p-12">
				<div className="relative w-52">
					<div className="absolute -top-40">
						<div className="relative">
							<img
								src={getUserImgSrc(data.user.imageId)}
								alt={userDisplayName}
								className="h-52 w-52 rounded-full object-cover"
							/>
						</div>
					</div>
				</div>

				<Spacer size="sm" />

				<div className="flex flex-col items-center">
					<div className="flex flex-wrap items-center justify-center gap-4">
						<h1 className="text-center text-h2">{userDisplayName}</h1>
					</div>
					<p className="text-night-200 mt-2 text-center">
						Joined {data.userJoinedDisplay}
					</p>
					<div className="mt-10 flex gap-4">
						{isLoggedInUser ? (
							<>
								<Button asChild>
									<Link prefetch="intent" to="jobs">
										My jobs
									</Link>
								</Button>
								<Button asChild>
									<Link prefetch="intent" to="/settings/profile">
										Edit profile
									</Link>
								</Button>
								<Button asChild>
									<Link prefetch="intent" to="resume/edit">
										Edit Resume
									</Link>
								</Button>
							</>
						) : (
							<Button asChild>
								<Link prefetch="intent" to="jobs">
									{userDisplayName}'s jobs
								</Link>
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No user with the username "{params.username}" exists</p>
				),
			}}
		/>
	)
}

export const meta: V2_MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.name ?? params.username
	return [
		{ title: `${displayName} | Resume Tailor` },
		{
			name: 'description',
			content: `${displayName} on Resume Tailor is not a host or renter yet.`,
		},
	]
}
