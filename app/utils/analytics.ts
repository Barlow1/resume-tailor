/**
 * GA4 Event Tracking Helper
 * Pushes events to Google Tag Manager's dataLayer for GA4 tracking
 */

declare global {
	interface Window {
		dataLayer: Array<Record<string, any>>
	}
}

export function trackEvent(eventName: string, params?: Record<string, any>) {
	if (typeof window !== 'undefined') {
		window.dataLayer = window.dataLayer || []
		window.dataLayer.push({
			event: eventName,
			...params,
		})
	}
}
