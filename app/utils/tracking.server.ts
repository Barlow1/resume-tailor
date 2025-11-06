/**
 * Server-side tracking utilities for analytics events
 * Logs events to console for debugging and can be extended to send to analytics services
 */

export interface TrackingEvent {
	event: string
	userId?: string
	properties?: Record<string, any>
	timestamp?: number
}

/**
 * Track an event on the server
 * Currently logs to console but can be extended to send to PostHog, Mixpanel, etc.
 */
export async function trackEvent(
	event: string,
	properties: Record<string, any> = {},
): Promise<void> {
	const trackingData: TrackingEvent = {
		event,
		properties,
		timestamp: Date.now(),
	}

	// Log to console for debugging
	console.log('[TRACKING]', JSON.stringify(trackingData, null, 2))

	// TODO: Send to analytics service (PostHog, Mixpanel, etc.)
	// Example:
	// await posthog.capture({
	//   distinctId: properties.userId,
	//   event,
	//   properties,
	// })
}

/**
 * Track resume upload events
 */
export function trackResumeUpload(data: {
	method: 'scratch' | 'upload' | 'existing'
	success: boolean
	userId?: string
	error?: string
	fileType?: string
	fileSize?: number
}) {
	return trackEvent('resume_uploaded', data)
}

/**
 * Track job selection events
 */
export function trackJobSelected(data: {
	jobId: string
	hasJobDescription: boolean
	userId?: string
	jobTitle?: string
}) {
	return trackEvent('job_selected', data)
}

/**
 * Track tailor button click
 */
export function trackTailorClicked(data: {
	jobId: string
	resumeId: string
	experienceCount: number
	userId?: string
	type: 'entire_resume' | 'single_bullet'
}) {
	return trackEvent('tailor_clicked', data)
}

/**
 * Track tailor completion
 */
export function trackTailorCompleted(data: {
	success: boolean
	error?: string
	duration: number
	changedFields?: string[]
	userId?: string
	resumeId?: string
	jobId?: string
	type: 'entire_resume' | 'single_bullet'
}) {
	return trackEvent('tailor_completed', data)
}

/**
 * Track post-tailor user actions
 */
export function trackPostTailorAction(data: {
	action: 'undo' | 'download' | 'edit' | 'close'
	timeFromTailor: number
	userId?: string
	resumeId?: string
}) {
	return trackEvent('post_tailor_action', data)
}

/**
 * Track AI modal interactions
 */
export function trackAIModalAction(data: {
	action: 'opened' | 'tailor_tab' | 'generate_tab' | 'tailor_started' | 'generate_started' | 'options_selected' | 'closed'
	userId?: string
	resumeId?: string
	jobId?: string
	selectionCount?: number
	subscriptionLimitHit?: boolean
}) {
	return trackEvent('ai_modal_action', data)
}

/**
 * Track resume parsing
 */
export function trackResumeParsing(data: {
	started?: boolean
	success?: boolean
	failed?: boolean
	error?: string
	userId?: string
	fileType?: string
	duration?: number
}) {
	return trackEvent('resume_parsing', data)
}

/**
 * Track PDF downloads
 */
export function trackPDFDownload(data: {
	success: boolean
	userId?: string
	resumeId?: string
	error?: string
}) {
	return trackEvent('pdf_downloaded', data)
}

/**
 * Track errors
 */
export function trackError(data: {
	error: string
	context: string
	userId?: string
	stack?: string
}) {
	return trackEvent('error_occurred', data)
}
