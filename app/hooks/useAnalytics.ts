/**
 * React Hook for Analytics
 *
 * Provides:
 * - Automatic route change tracking
 * - Type-safe event tracking
 * - User identification helpers
 * - Paywall and AI modal tracking
 */

import { useEffect, useRef, useCallback } from 'react'
import { useLocation } from '@remix-run/react'
import {
	track,
	trackPageView,
	identify,
	setUserProperties,
	resetIdentity,
	trackFeatureFirstUse,
	trackPaywallShown,
	trackPaywallDismissed,
	trackAiModalOpened,
	trackAiModalClosed,
	markAiModalResult,
	trackCtaClick,
	getAnonymousId,
} from '~/lib/analytics.client.ts'
import type {
	AnalyticsEventName,
	AnalyticsEventMap,
	UserProperties,
	FeatureName,
	PaywallTrigger,
} from '~/lib/analytics.types.ts'

// ============================================================================
// MAIN HOOK
// ============================================================================

interface UseAnalyticsOptions {
	/** Disable automatic page view tracking */
	disablePageViews?: boolean
}

interface UseAnalyticsReturn {
	/** Track a typed event */
	track: <T extends AnalyticsEventName>(
		eventName: T,
		properties: AnalyticsEventMap[T],
	) => void
	/** Track page view */
	trackPageView: (path?: string) => void
	/** Identify user on login/signup */
	identify: (userId: string, properties?: UserProperties) => void
	/** Update user properties */
	setUserProperties: (properties: UserProperties) => void
	/** Reset identity on logout */
	resetIdentity: () => void
	/** Track first use of a feature */
	trackFeatureFirstUse: (featureName: FeatureName) => void
	/** Track CTA click */
	trackCtaClick: (ctaName: string, ctaLocation: string, destination: string) => void
	/** Get anonymous ID */
	getAnonymousId: () => string
	/** Paywall tracking helpers */
	paywall: {
		shown: (trigger: PaywallTrigger, usageCount: number, limit: number) => void
		dismissed: (trigger: PaywallTrigger) => void
	}
	/** AI Modal tracking helpers */
	aiModal: {
		opened: (modalType: 'tailor' | 'generate', experienceId?: string) => void
		closed: (wasAccepted: boolean) => void
		markResult: () => void
	}
}

export function useAnalytics(options: UseAnalyticsOptions = {}): UseAnalyticsReturn {
	const location = useLocation()
	const previousPath = useRef<string | null>(null)

	// Track page views on route change
	useEffect(() => {
		if (options.disablePageViews) return

		const currentPath = location.pathname

		// Only track if path actually changed
		if (currentPath !== previousPath.current) {
			trackPageView(currentPath)
			previousPath.current = currentPath
		}
	}, [location.pathname, options.disablePageViews])

	// Memoized tracking functions
	const trackEvent = useCallback(
		<T extends AnalyticsEventName>(
			eventName: T,
			properties: AnalyticsEventMap[T],
		) => {
			track(eventName, properties)
		},
		[],
	)

	const handleTrackPageView = useCallback((path?: string) => {
		trackPageView(path || location.pathname)
	}, [location.pathname])

	const handleIdentify = useCallback(
		(userId: string, properties?: UserProperties) => {
			identify(userId, properties)
		},
		[],
	)

	const handleSetUserProperties = useCallback((properties: UserProperties) => {
		setUserProperties(properties)
	}, [])

	const handleResetIdentity = useCallback(() => {
		resetIdentity()
	}, [])

	const handleTrackFeatureFirstUse = useCallback((featureName: FeatureName) => {
		trackFeatureFirstUse(featureName)
	}, [])

	const handleTrackCtaClick = useCallback(
		(ctaName: string, ctaLocation: string, destination: string) => {
			trackCtaClick(ctaName, ctaLocation, destination)
		},
		[],
	)

	const handleGetAnonymousId = useCallback(() => {
		return getAnonymousId()
	}, [])

	// Paywall helpers
	const paywall = {
		shown: useCallback(
			(trigger: PaywallTrigger, usageCount: number, limit: number) => {
				trackPaywallShown(trigger, usageCount, limit)
			},
			[],
		),
		dismissed: useCallback((trigger: PaywallTrigger) => {
			trackPaywallDismissed(trigger)
		}, []),
	}

	// AI Modal helpers
	const aiModal = {
		opened: useCallback(
			(modalType: 'tailor' | 'generate', experienceId?: string) => {
				trackAiModalOpened(modalType, experienceId)
			},
			[],
		),
		closed: useCallback((wasAccepted: boolean) => {
			trackAiModalClosed(wasAccepted)
		}, []),
		markResult: useCallback(() => {
			markAiModalResult()
		}, []),
	}

	return {
		track: trackEvent,
		trackPageView: handleTrackPageView,
		identify: handleIdentify,
		setUserProperties: handleSetUserProperties,
		resetIdentity: handleResetIdentity,
		trackFeatureFirstUse: handleTrackFeatureFirstUse,
		trackCtaClick: handleTrackCtaClick,
		getAnonymousId: handleGetAnonymousId,
		paywall,
		aiModal,
	}
}

// ============================================================================
// SPECIALIZED HOOKS
// ============================================================================

/**
 * Hook for tracking builder interactions
 */
export function useBuilderAnalytics(resumeId: string, hasJob: boolean) {
	const { track, trackFeatureFirstUse } = useAnalytics({ disablePageViews: true })
	const hasTrackedOpen = useRef(false)

	// Track builder opened on mount
	useEffect(() => {
		if (!hasTrackedOpen.current) {
			trackFeatureFirstUse('builder')
			// Section count will be passed from component
		}
		hasTrackedOpen.current = true
	}, [trackFeatureFirstUse])

	const trackSectionEdit = useCallback(
		(section: 'experience' | 'education' | 'skills' | 'summary' | 'contact' | 'header') => {
			track('builder_section_edited', {
				section,
				resume_id: resumeId,
			})
		},
		[track, resumeId],
	)

	const trackBuilderOpened = useCallback(
		(sectionCount: number) => {
			track('builder_opened', {
				resume_id: resumeId,
				has_job: hasJob,
				section_count: sectionCount,
			})
		},
		[track, resumeId, hasJob],
	)

	return {
		trackSectionEdit,
		trackBuilderOpened,
	}
}

/**
 * Hook for tracking checkout flow
 */
export function useCheckoutAnalytics() {
	const { track } = useAnalytics({ disablePageViews: true })

	const trackCheckoutStarted = useCallback(
		(
			plan: 'weekly' | 'monthly',
			isTrial: boolean,
			trigger: 'ai_limit' | 'download_limit' | 'analysis_limit' | 'outreach_limit' | 'direct',
		) => {
			track('checkout_started', {
				plan,
				is_trial: isTrial,
				trigger,
			})
		},
		[track],
	)

	return { trackCheckoutStarted }
}

/**
 * Hook for tracking onboarding flow
 */
export function useOnboardingAnalytics() {
	const { track } = useAnalytics({ disablePageViews: true })
	const startTime = useRef<number | null>(null)

	useEffect(() => {
		if (!startTime.current) {
			startTime.current = Date.now()
		}
	}, [])

	const trackPathSelected = useCallback(
		(path: 'tailor' | 'generate' | 'scratch' | 'upload-generate') => {
			track('onboarding_path_selected', { path })
		},
		[track],
	)

	const trackStepCompleted = useCallback(
		(
			stepName: string,
			stepNumber: number,
			path: 'tailor' | 'generate' | 'scratch' | 'upload-generate',
		) => {
			track('onboarding_step_completed', {
				step_name: stepName,
				step_number: stepNumber,
				path,
			})
		},
		[track],
	)

	const trackOnboardingCompleted = useCallback(
		(path: 'tailor' | 'generate' | 'scratch' | 'upload-generate') => {
			const duration = startTime.current
				? Math.round((Date.now() - startTime.current) / 1000)
				: 0

			track('onboarding_completed', {
				path,
				duration_seconds: duration,
			})
		},
		[track],
	)

	return {
		trackPathSelected,
		trackStepCompleted,
		trackOnboardingCompleted,
	}
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to track time spent on a page/component
 */
export function useTimeTracking(eventName: string, properties: Record<string, unknown> = {}) {
	const startTime = useRef<number>(Date.now())
	const { track } = useAnalytics({ disablePageViews: true })

	useEffect(() => {
		startTime.current = Date.now()

		return () => {
			const duration = Math.round((Date.now() - startTime.current) / 1000)
			// Note: This won't fire reliably on tab close, but works for navigation
			console.log(`[Analytics] Time on ${eventName}:`, duration, 'seconds')
		}
	}, [eventName])

	const trackWithDuration = useCallback(() => {
		const duration = Math.round((Date.now() - startTime.current) / 1000)
		track(eventName as AnalyticsEventName, {
			...properties,
			duration_seconds: duration,
		} as AnalyticsEventMap[AnalyticsEventName])
	}, [track, eventName, properties])

	return { trackWithDuration }
}
