import { redirect } from '@remix-run/node'
import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticator, KNOWN_AUTH_PROVIDERS } from '~/utils/auth.server.ts'
import { invariantResponse } from '~/utils/misc.ts'

export const loader = () => redirect('/login')

export const action = ({ request, params }: ActionFunctionArgs) => {
	invariantResponse(
		params.provider && KNOWN_AUTH_PROVIDERS.includes(params.provider),
		'Unknown auth provider',
		{ status: 404 },
	)
	return authenticator.authenticate(params.provider, request)
}
