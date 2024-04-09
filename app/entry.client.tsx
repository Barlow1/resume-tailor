import { RemixBrowser } from '@remix-run/react'
import { startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import LogRocket from 'logrocket'
import setupLogRocketReact from 'logrocket-react'

if (ENV.MODE === 'development') {
	import('~/utils/devtools.tsx').then(({ init }) => init())
}
if (ENV.MODE === 'production' && ENV.SENTRY_DSN) {
	import('~/utils/monitoring.client.tsx').then(({ init }) => init())
}

if (!ENV.CI && ENV.MODE === 'production' && typeof window !== 'undefined') {
	LogRocket.init('cnp1eb/resume-tailor')
	setupLogRocketReact(LogRocket)
}

startTransition(() => {
	hydrateRoot(document, <RemixBrowser />)
})
