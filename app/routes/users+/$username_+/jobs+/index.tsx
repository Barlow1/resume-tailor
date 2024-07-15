import { useLoaderData, NavLink, Link } from '@remix-run/react'
import { json, type DataFunctionArgs } from '@remix-run/node'
import { prisma } from '~/utils/db.server.ts'
import { cn, getUserImgSrc } from '~/utils/misc.ts'
import { requireUserId } from '~/utils/auth.server.ts'

export async function loader({ params, request }: DataFunctionArgs) {
	await requireUserId(request, { redirectTo: null })
	const owner = await prisma.user.findUnique({
		where: {
			username: params.username,
		},
		select: {
			id: true,
			username: true,
			name: true,
			imageId: true,
		},
	})
	if (!owner) {
		throw new Response('Not found', { status: 404 })
	}
	const jobs = await prisma.job.findMany({
		where: {
			ownerId: owner.id,
		},
		select: {
			id: true,
			title: true,
		},
	})
	return json({ owner, jobs })
}

export default function JobIndexRoute() {
	const data = useLoaderData<typeof loader>()
	const ownerDisplayName = data.owner.name ?? data.owner.username
	const navLinkDefaultClassName =
		'line-clamp-2 block rounded-l-full py-2 pl-8 pr-6 text-base lg:text-xl'
	return (
		<div className="col-span-1 py-12">
			<Link
				to={`/users/${data.owner.username}`}
				className="mb-4 flex flex-col items-center justify-center gap-2 pl-8 pr-4 lg:flex-row lg:justify-start lg:gap-4"
			>
				<img
					src={getUserImgSrc(data.owner.imageId)}
					alt={ownerDisplayName}
					className="h-16 w-16 rounded-full object-cover lg:h-24 lg:w-24"
				/>
				<h1 className="text-center text-base font-bold md:text-lg lg:text-left lg:text-2xl">
					{ownerDisplayName}'s Jobs
				</h1>
			</Link>
			<ul>
				<li>
					<NavLink
						to="new"
						className={({ isActive }) =>
							cn(navLinkDefaultClassName, isActive && 'bg-accent')
						}
					>
						+ New Job
					</NavLink>
				</li>
				{data.jobs.map(job => (
					<li key={job.id}>
						<NavLink
							to={job.id}
							className={({ isActive }) =>
								cn(navLinkDefaultClassName, isActive && 'bg-accent')
							}
						>
							{job.title}
						</NavLink>
					</li>
				))}
			</ul>
		</div>
	)
}
