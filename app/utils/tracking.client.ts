/**
 * Client-side tracking utilities
 * Uses existing Google Analytics gtag integration
 */

import * as gtag from './gtags.client.ts'

export interface ClientTrackingEvent {
	event: string
	properties?: Record<string, any>
}

/**
 * Track an event on the client using Google Analytics
 */
export function trackEvent(event: string, properties: Record<string, any> = {}): void {
	// Log to console in development
	if (process.env.NODE_ENV === 'development') {
		console.log('[CLIENT TRACKING]', event, properties)
	}

	// Send to Google Analytics
	gtag.event({
		action: event,
		category: properties.category || 'User Action',
		label: properties.label || event,
		value: properties.value || '',
	})
}

/**
 * Track time spent on a specific action
 */
export class ActionTimer {
	private startTime: number
	private eventName: string
	private metadata: Record<string, any>

	constructor(eventName: string, metadata: Record<string, any> = {}) {
		this.startTime = Date.now()
		this.eventName = eventName
		this.metadata = metadata
	}

	complete(additionalData: Record<string, any> = {}) {
		const duration = Date.now() - this.startTime
		trackEvent(`${this.eventName}_completed`, {
			...this.metadata,
			...additionalData,
			duration,
		})
		return duration
	}

	fail(error: string, additionalData: Record<string, any> = {}) {
		const duration = Date.now() - this.startTime
		trackEvent(`${this.eventName}_failed`, {
			...this.metadata,
			...additionalData,
			error,
			duration,
		})
		return duration
	}
}
