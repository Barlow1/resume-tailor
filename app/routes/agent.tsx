import { redirect, type LoaderFunctionArgs } from '@remix-run/node'

/**
 * The Career Agent page moved to /reverse-recruiter.
 *
 * "Reverse recruiter" is the term people actually search for (~1.2k US/mo,
 * KD 12) — /agent was self-referential and carried no meaningful links or
 * rankings, so a permanent redirect costs us nothing and consolidates all
 * signals onto the single money page.
 *
 * Keep this redirect indefinitely: the old URL is live in Stripe receipts,
 * emails, and anything already shared.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const { search } = new URL(request.url)
	return redirect(`/reverse-recruiter${search}`, {
		status: 301,
		headers: { 'Cache-Control': 'public, max-age=3600' },
	})
}

export default function AgentRedirect() {
	return null
}
