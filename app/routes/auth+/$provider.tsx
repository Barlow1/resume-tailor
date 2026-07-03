import { redirect } from '@remix-run/node'
import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/utils/auth.server.ts'
import { invariantResponse } from '~/utils/misc.ts'

// Must match the strategies registered in auth.server.ts — bots probe
// /auth/signin etc., and an unknown name makes remix-auth throw a 500.
const KNOWN_PROVIDERS = ['google', 'github', 'linkedin']

export const loader = () => redirect('/login')

export const action = ({ request, params }: ActionFunctionArgs) => {
	invariantResponse(
		params.provider && KNOWN_PROVIDERS.includes(params.provider),
		'Unknown auth provider',
		{ status: 404 },
	)
	return authenticator.authenticate(params.provider, request)
}
