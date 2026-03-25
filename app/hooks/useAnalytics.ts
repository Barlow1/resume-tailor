import { useEffect, useRef } from 'react'
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
	UserProperties,
	PaywallTrigger,
} from '~/lib/analytics.types.ts'

interface UseAnalyticsOptions {
	disablePageViews?: boolean
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
	const location = useLocation()
	const previousPath = useRef<string | null>(null)

	useEffect(() => {
		if (options.disablePageViews) return
		const currentPath = location.pathname
		if (currentPath !== previousPath.current) {
			trackPageView(currentPath)
			previousPath.current = currentPath
		}
	}, [location.pathname, options.disablePageViews])

	return {
		track,
		trackPageView: (path?: string) => trackPageView(path || location.pathname),
		identify: (userId: string, properties?: UserProperties) => identify(userId, properties),
		setUserProperties,
		resetIdentity,
		trackFeatureFirstUse,
		trackCtaClick,
		getAnonymousId,
		paywall: {
			shown: (trigger: PaywallTrigger, usageCount: number, limit: number) =>
				trackPaywallShown(trigger, usageCount, limit),
			dismissed: (trigger: PaywallTrigger) => trackPaywallDismissed(trigger),
		},
		aiModal: {
			opened: (modalType: 'tailor' | 'generate', experienceId?: string) =>
				trackAiModalOpened(modalType, experienceId),
			closed: (wasAccepted: boolean) => trackAiModalClosed(wasAccepted),
			markResult: () => markAiModalResult(),
		},
	}
}
