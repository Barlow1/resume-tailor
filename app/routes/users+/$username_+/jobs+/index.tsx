import { Link } from '@remix-run/react'

export default function JobIndexRoute() {
	return (
		<div className="flex h-full flex-col">
			<p className="text-bold my-auto text-center text-xl">
				Select a job or{' '}
				<Link to={'new'} className="underline">
					add a new one
				</Link>
			</p>
		</div>
	)
}
