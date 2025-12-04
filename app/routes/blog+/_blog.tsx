import { Outlet , useMatches } from '@remix-run/react'
import Breadcrumbs from '~/components/ui/breadcrumbs.tsx'
import { Spacer } from '~/components/spacer.tsx'
import { Prose } from '~/components/prose.tsx'

import { useMemo } from 'react'
import clsx from 'clsx'

export default function BlogPostLayout() {
	const matches = useMatches()
	console.log(matches)
	const isIndexRoute = matches.some(m => m.id === 'routes/blog+/_index')
	const ContentComponent = useMemo(() => {
		if (isIndexRoute) {
			return <Outlet />
		}
		return (
			<Prose>
				<Spacer size="xs" />
				<Outlet />
			</Prose>
		)
	}, [isIndexRoute])

	const className = useMemo(() => {
		return clsx('mx-auto px-4', {
			'max-w-3xl': !isIndexRoute,
		})
	}, [isIndexRoute])
	return (
		<div className={className}>
			<Breadcrumbs
				origin={{
					breadcrumb: 'Blog',
					pathname: '/blog',
				}}
			/>
			{ContentComponent}
		</div>
	)
}
