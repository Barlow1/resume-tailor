import { useMatches, Link, type UIMatch } from '@remix-run/react'
import type { ReactNode } from 'react'
import { cn } from '~/utils/misc.ts'

interface Breadcrumb<T = ReactNode> {
	pathname: string
	breadcrumb: T
}

export default function Breadcrumbs({ origin }: { origin: Breadcrumb }) {
	const matches = useMatches() as UIMatch<
		{},
		Breadcrumb<ReactNode | ((data: any) => ReactNode)>
	>[]
	const breadcrumbs = matches
		.map(m =>
			m.handle?.breadcrumb ? (
				<Link
					key={m.id}
					to={m.pathname}
					className="items-center"
				>
					{typeof m.handle.breadcrumb === 'function'
						? m.handle.breadcrumb(m.data)
						: m.handle.breadcrumb}
				</Link>
			) : null,
		)
		.filter(Boolean)
	if (!breadcrumbs.length) return null
	return (
		<ul className="flex flex-wrap gap-3">
			<li>
				<Link className="text-muted-foreground" to={origin.pathname}>
					{origin.breadcrumb}
				</Link>
			</li>
			{breadcrumbs.map((breadcrumb, i, arr) => (
				<li
					key={i}
					className={cn('max-w-[10rem] items-center gap-3 truncate', {
						'text-muted-foreground': i < arr.length - 1,
					})}
				>
					▶️ {breadcrumb}
				</li>
			))}
		</ul>
	)
}
