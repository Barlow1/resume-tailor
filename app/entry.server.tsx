import { Response, type HandleDocumentRequestFunction } from '@remix-run/node'
import { RemixServer } from '@remix-run/react'
import isbot from 'isbot'
import { getInstanceInfo } from 'litefs-js'
import rds from 'react-dom/server'
import { getEnv, init } from './utils/env.server.ts'
import { NonceProvider } from './utils/nonce-provider.ts'
const { renderToReadableStream } = rds

init()
global.ENV = getEnv()

if (ENV.MODE === 'production' && ENV.SENTRY_DSN) {
	import('~/utils/monitoring.server.ts').then(({ init }) => init())
}

type DocRequestArgs = Parameters<HandleDocumentRequestFunction>

export default async function handleRequest(...args: DocRequestArgs) {
	let [
		request,
		responseStatusCode,
		responseHeaders,
		remixContext,
		loadContext,
	] = args
	const { currentInstance, primaryInstance } = await getInstanceInfo()
	responseHeaders.set('fly-region', process.env.FLY_REGION ?? 'unknown')
	responseHeaders.set('fly-app', process.env.FLY_APP_NAME ?? 'unknown')
	responseHeaders.set('fly-primary-instance', primaryInstance)
	responseHeaders.set('fly-instance', currentInstance)

	const nonce = String(loadContext.cspNonce) ?? undefined
	const stream = await renderToReadableStream(
		<NonceProvider value={nonce}>
			<RemixServer context={remixContext} url={request.url} />
		</NonceProvider>,
		{
			onError: (error: unknown) => {
				responseStatusCode = 500
				console.error(error)
			},
		},
	)
	if (isbot(request.headers.get('user-agent'))) {
		await stream.allReady
	}

	const headers = new Headers(responseHeaders)
	headers.set('Content-Type', 'text/html')
	return new Response(stream, {
		headers,
		status: responseStatusCode,
	})
}

export async function handleDataRequest(response: Response) {
	const { currentInstance, primaryInstance } = await getInstanceInfo()
	response.headers.set('fly-region', process.env.FLY_REGION ?? 'unknown')
	response.headers.set('fly-app', process.env.FLY_APP_NAME ?? 'unknown')
	response.headers.set('fly-primary-instance', primaryInstance)
	response.headers.set('fly-instance', currentInstance)

	return response
}
