import { Outlet } from '@remix-run/react'
import Breadcrumbs from '~/components/ui/breadcrumbs.tsx'
import { Spacer } from '~/components/spacer.tsx'
import { Prose } from '~/components/prose.tsx'

export default function BlogPostLayout() {
	return (
		<div className="mx-auto max-w-3xl px-4">
			<Breadcrumbs
				origin={{
					breadcrumb: 'Blog',
					pathname: '/blog',
				}}
			/>
			<Spacer size="xs" />
			<Prose>
				<Outlet />
			</Prose>
		</div>
	)
}

