import { useMatches, Link } from '@remix-run/react'
import { cn } from '~/utils/misc.ts'

export default function Breadcrumbs({
	origin,
}: {
	origin: { pathname: string; breadcrumb: string }
}) {
	const matches = useMatches()
	const breadcrumbs = matches
		.map(m =>
			m.handle?.breadcrumb ? (
				<Link key={m.id} to={m.pathname} className="flex items-center">
					{m.handle.breadcrumb}
				</Link>
			) : null,
		)
		.filter(Boolean)
	if (!breadcrumbs.length) return null
	return (
		<ul className="flex gap-3">
			<li>
				<Link className="text-muted-foreground" to={origin.pathname}>
					{origin.breadcrumb}
				</Link>
			</li>
			{breadcrumbs.map((breadcrumb, i, arr) => (
				<li
					key={i}
					className={cn('flex items-center gap-3', {
						'text-muted-foreground': i < arr.length - 1,
					})}
				>
					▶️ {breadcrumb}
				</li>
			))}
		</ul>
	)
}
