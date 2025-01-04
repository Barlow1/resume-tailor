import { redirect } from '@remix-run/node'
import type { ActionFunctionArgs } from '@remix-run/node'
import invariant from 'tiny-invariant'
import { authenticator } from '~/utils/auth.server.ts'

export const loader = () => redirect('/login')

export const action = ({ request, params }: ActionFunctionArgs) => {
	invariant(params.provider, 'provider is a required parameter')
	return authenticator.authenticate(params.provider, request)
}
