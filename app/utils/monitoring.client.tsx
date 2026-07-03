import { useLocation, useMatches } from '@remix-run/react'
import * as Sentry from '@sentry/remix'
import { useEffect } from 'react'

export function init() {
	Sentry.init({
		dsn: ENV.SENTRY_DSN,
		integrations: [
			new Sentry.BrowserTracing({
				routingInstrumentation: Sentry.remixRouterInstrumentation(
					useEffect,
					useLocation,
					useMatches,
				),
			}),
			// Replay is only available in the client
			new Sentry.Replay(),
		],

		// Set tracesSampleRate to 1.0 to capture 100%
		// of transactions for performance monitoring.
		// We recommend adjusting this value in production
		tracesSampleRate: 1.0,

		// Capture Replay for 10% of all sessions,
		// plus for 100% of sessions with an error
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,

		// Benign cancellations: the Remix router aborts in-flight fetchers and
		// navigations on route changes; posthog aborts flag fetches on unload.
		ignoreErrors: [
			/^AbortError/,
			/signal is aborted/i,
			/user aborted a request/i,
			/operation was aborted/i,
			/aborted without reason/i,
			/ResizeObserver loop/i,
			/reCAPTCHA Timeout/i,
			/Cannot redefine property: walletRouter/i,
			// Session-replay recorder internals (bundled, so denyUrls can't
			// catch them): rrweb probing cross-origin iframes it can't record.
			// (Firefox's generic cross-origin SecurityError is handled in
			// beforeSend, scoped to rrweb frames — a message-level ignore here
			// would also hide real app cross-origin bugs.)
			/bufferBelongsToIframe/i,
		],

		// Errors thrown by code we don't control: browser extensions, Safari's
		// masked extension frames, posthog's lazy-loaded recorder script.
		denyUrls: [
			/^chrome-extension:\/\//i,
			/^moz-extension:\/\//i,
			/^safari(-web)?-extension:\/\//i,
			/webkit-masked-url/i,
			/posthog\.com\/static\//i,
			/recaptcha\/releases\//i,
		],

		beforeSend(event, hint) {
			const ex = hint?.originalException
			// AbortError DOMExceptions that slip past message matching
			if (
				typeof DOMException !== 'undefined' &&
				ex instanceof DOMException &&
				ex.name === 'AbortError'
			) {
				return null
			}
			// Firefox's cross-origin SecurityError thrown inside the bundled
			// session-replay recorder — filter by stack frame, not message, so
			// real app cross-origin bugs still report.
			const topException = event.exception?.values?.[0]
			if (
				topException?.value &&
				/Permission denied to access property/i.test(topException.value)
			) {
				const frames = topException.stacktrace?.frames ?? []
				if (
					frames.some(f =>
						`${f.filename ?? ''} ${f.module ?? ''} ${f.function ?? ''}`.includes(
							'rrweb',
						),
					)
				) {
					return null
				}
			}
			// unhandledrejection whose "reason" is a DOM Event/CustomEvent or a
			// keyless PLAIN object: no stack, no message, nothing actionable.
			// (Class instances like Response have a non-Object prototype and
			// carry real signal — keep those.)
			const mechanism = topException?.mechanism?.type
			if (
				mechanism === 'onunhandledrejection' &&
				ex != null &&
				!(ex instanceof Error)
			) {
				if (typeof Event !== 'undefined' && ex instanceof Event) return null
				if (
					typeof ex === 'object' &&
					(Object.getPrototypeOf(ex) === Object.prototype ||
						Object.getPrototypeOf(ex) === null) &&
					Object.keys(ex).length === 0
				) {
					return null
				}
			}
			return event
		},
	})
}
