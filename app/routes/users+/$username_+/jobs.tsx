import { Outlet } from '@remix-run/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { Spacer } from '~/components/spacer.tsx'
import Breadcrumbs from '~/components/ui/breadcrumbs.tsx'

export default function JobsRoute() {

	return (
		<div className="flex h-full pb-12">
			<div className="md:container m-auto max-w-3xl">
				<Breadcrumbs
					origin={{
						breadcrumb: 'Jobs',
						pathname: `/jobs`,
					}}
				/>
				<Spacer size="xs" />
				<main>
					<Outlet />
				</main>
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
