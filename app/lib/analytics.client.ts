/**
 * PostHog Client-Side Analytics
 *
 * Handles:
 * - PostHog initialization
 * - Anonymous ID generation and persistence
 * - Type-safe event tracking
 * - User identification on login/signup
 * - Automatic common properties
 */

import posthogLib from 'posthog-js'
import type {
	AnalyticsEventName,
	AnalyticsEventMap,
	UserProperties,
	CommonEventProperties,
	FeatureName,
} from './analytics.types.ts'

// Get the PostHog instance
const posthog = posthogLib

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANONYMOUS_ID_KEY = 'rt_anonymous_id'
const FIRST_USE_PREFIX = 'rt_first_use_'

// ============================================================================
// ANONYMOUS ID MANAGEMENT
// ============================================================================

/**
 * Generate a UUID v4 for anonymous tracking
 */
function generateAnonymousId(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

/**
 * Get or create anonymous ID from cookie/localStorage
 */
export function getAnonymousId(): string {
	if (typeof window === 'undefined') {
		return generateAnonymousId()
	}

	// Try localStorage first
	let anonymousId = localStorage.getItem(ANONYMOUS_ID_KEY)

	if (!anonymousId) {
		// Try cookie as fallback
		const cookies = document.cookie.split(';')
		const cookie = cookies.find(c => c.trim().startsWith(`${ANONYMOUS_ID_KEY}=`))
		if (cookie) {
			anonymousId = cookie.split('=')[1]
		}
	}

	if (!anonymousId) {
		anonymousId = generateAnonymousId()
		// Store in both localStorage and cookie for persistence
		localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId)
		// Set cookie with 1 year expiry
		const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
		document.cookie = `${ANONYMOUS_ID_KEY}=${anonymousId}; expires=${expires}; path=/; SameSite=Lax`
	}

	return anonymousId
}

// ============================================================================
// POSTHOG INITIALIZATION
// ============================================================================

let isInitialized = false

interface InitOptions {
	apiKey?: string
	apiHost?: string
	debug?: boolean
}

/**
 * Initialize PostHog client
 * Should be called once in root.tsx
 */
export function initAnalytics(options: InitOptions = {}): void {
	if (typeof window === 'undefined') return
	if (isInitialized) return

	const apiKey = options.apiKey
	const apiHost = options.apiHost || 'https://us.i.posthog.com'

	// Don't initialize without a valid API key
	if (!apiKey || !apiKey.startsWith('phc_')) {
		if (process.env.NODE_ENV === 'development') {
			console.warn('[Analytics] PostHog not initialized: Missing or invalid API key')
		}
		return
	}

	posthog.init(apiKey, {
		api_host: apiHost,
		// Capture pageviews manually for SPA
		capture_pageview: false,
		// Capture pageleaves for session duration
		capture_pageleave: true,
		// Persist across sessions
		persistence: 'localStorage+cookie',
		// Respect Do Not Track
		respect_dnt: true,
		// Session recording config
		disable_session_recording: false,
		session_recording: {
			// Mask all text for privacy
			maskAllInputs: true,
			maskTextSelector: '[data-mask]',
		},
		// Loaded callback
		loaded: ph => {
			// Set anonymous ID
			const anonymousId = getAnonymousId()
			ph.register({ anonymous_id: anonymousId })

			if (options.debug) {
				console.log('[Analytics] PostHog initialized', { anonymousId })
			}
		},
	})

	isInitialized = true
}

// ============================================================================
// COMMON PROPERTIES
// ============================================================================

/**
 * Get common properties added to all events
 */
function getCommonProperties(): Partial<CommonEventProperties> {
	const props: Partial<CommonEventProperties> = {
		timestamp: new Date().toISOString(),
		platform: 'web',
		anonymous_id: getAnonymousId(),
	}

	// Add user context if available
	if (typeof window !== 'undefined') {
		const userId = posthog.get_distinct_id?.()
		if (userId && !userId.startsWith('$')) {
			props.user_id = userId
			props.is_authenticated = true
		} else {
			props.is_authenticated = false
		}
	}

	return props
}

// ============================================================================
// TRACKING FUNCTIONS
// ============================================================================

/**
 * Type-safe event tracking
 * Automatically adds common properties
 */
export function track<T extends AnalyticsEventName>(
	eventName: T,
	properties: AnalyticsEventMap[T],
): void {
	if (typeof window === 'undefined') return

	const fullProperties = {
		...getCommonProperties(),
		...properties,
	}

	posthog.capture(eventName, fullProperties)

	// Debug logging in development
	if (process.env.NODE_ENV === 'development') {
		console.log('[Analytics] Track:', eventName, fullProperties)
	}
}

/**
 * Track page view with UTM parameters
 */
export function trackPageView(path: string): void {
	if (typeof window === 'undefined') return

	const url = new URL(window.location.href)
	const referrer = document.referrer || null

	track('page_viewed', {
		path,
		referrer,
		utm_source: url.searchParams.get('utm_source') || undefined,
		utm_medium: url.searchParams.get('utm_medium') || undefined,
		utm_campaign: url.searchParams.get('utm_campaign') || undefined,
		utm_term: url.searchParams.get('utm_term') || undefined,
		utm_content: url.searchParams.get('utm_content') || undefined,
	})

	// Also send to PostHog's built-in pageview
	posthog.capture('$pageview', { $current_url: window.location.href })
}

// ============================================================================
// IDENTITY MANAGEMENT
// ============================================================================

/**
 * Identify user on login/signup
 * Links anonymous ID to user ID for cross-session tracking
 */
export function identify(userId: string, properties?: UserProperties): void {
	if (typeof window === 'undefined') return

	const anonymousId = getAnonymousId()

	// Identify with user ID
	posthog.identify(userId, {
		...properties,
		anonymous_id: anonymousId,
	})

	// Alias anonymous ID to user ID for event stitching
	posthog.alias(userId, anonymousId)

	if (process.env.NODE_ENV === 'development') {
		console.log('[Analytics] Identify:', userId, { anonymousId, ...properties })
	}
}

/**
 * Update user properties without changing identity
 */
export function setUserProperties(properties: UserProperties): void {
	if (typeof window === 'undefined') return

	posthog.people.set(properties)
}

/**
 * Reset identity on logout
 */
export function resetIdentity(): void {
	if (typeof window === 'undefined') return

	posthog.reset()

	// Generate new anonymous ID
	const newAnonymousId = generateAnonymousId()
	localStorage.setItem(ANONYMOUS_ID_KEY, newAnonymousId)
	posthog.register({ anonymous_id: newAnonymousId })
}

// ============================================================================
// FEATURE FIRST USE TRACKING
// ============================================================================

/**
 * Track first use of a feature
 * Uses localStorage to ensure event fires only once per user
 */
export function trackFeatureFirstUse(featureName: FeatureName): void {
	if (typeof window === 'undefined') return

	const key = `${FIRST_USE_PREFIX}${featureName}`

	if (!localStorage.getItem(key)) {
		track('feature_first_use', { feature_name: featureName })
		localStorage.setItem(key, new Date().toISOString())
	}
}

/**
 * Check if user has used a feature before
 */
export function hasUsedFeature(featureName: FeatureName): boolean {
	if (typeof window === 'undefined') return false
	return !!localStorage.getItem(`${FIRST_USE_PREFIX}${featureName}`)
}

// ============================================================================
// PAYWALL TRACKING HELPERS
// ============================================================================

let paywallShownAt: number | null = null

/**
 * Track paywall shown and start timer for dismissal tracking
 */
export function trackPaywallShown(
	trigger: 'ai_limit' | 'download_limit' | 'analysis_limit' | 'outreach_limit',
	usageCount: number,
	limit: number,
): void {
	paywallShownAt = Date.now()
	track('paywall_shown', {
		trigger,
		usage_count: usageCount,
		limit,
	})
}

/**
 * Track paywall dismissal with time viewed
 */
export function trackPaywallDismissed(
	trigger: 'ai_limit' | 'download_limit' | 'analysis_limit' | 'outreach_limit',
): void {
	const timeViewed = paywallShownAt ? Date.now() - paywallShownAt : 0
	track('paywall_dismissed', {
		trigger,
		time_viewed_ms: timeViewed,
	})
	paywallShownAt = null
}

// ============================================================================
// AI MODAL TRACKING HELPERS
// ============================================================================

let aiModalOpenedAt: number | null = null
let aiModalType: 'tailor' | 'generate' | null = null
let aiModalHadResult = false

/**
 * Track AI modal opened and start session
 */
export function trackAiModalOpened(
	modalType: 'tailor' | 'generate',
	experienceId?: string,
): void {
	aiModalOpenedAt = Date.now()
	aiModalType = modalType
	aiModalHadResult = false

	track('ai_modal_opened', {
		modal_type: modalType,
		experience_id: experienceId,
	})
}

/**
 * Mark that AI modal received a result
 */
export function markAiModalResult(): void {
	aiModalHadResult = true
}

/**
 * Track AI modal closed
 */
export function trackAiModalClosed(wasAccepted: boolean): void {
	if (aiModalType) {
		track('ai_modal_closed', {
			modal_type: aiModalType,
			had_result: aiModalHadResult,
			was_accepted: wasAccepted,
		})
	}
	aiModalOpenedAt = null
	aiModalType = null
	aiModalHadResult = false
}

// ============================================================================
// CTA TRACKING HELPER
// ============================================================================

/**
 * Track CTA click with location context
 */
export function trackCtaClick(
	ctaName: string,
	ctaLocation: string,
	destination: string,
): void {
	track('cta_clicked', {
		cta_name: ctaName,
		cta_location: ctaLocation,
		destination,
	})
}

// ============================================================================
// SESSION / FEATURE FLAGS
// ============================================================================

/**
 * Get PostHog feature flag value
 */
export function getFeatureFlag(flagName: string): boolean | string | undefined {
	if (typeof window === 'undefined') return undefined
	return posthog.getFeatureFlag(flagName)
}

/**
 * Check if feature flag is enabled
 */
export function isFeatureFlagEnabled(flagName: string): boolean {
	const value = getFeatureFlag(flagName)
	return value === true || value === 'true'
}

// ============================================================================
// EXPORTS
// ============================================================================

export { posthog }
