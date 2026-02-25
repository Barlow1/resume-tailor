/**
 * Custom Hook: useOnboardingFlow
 *
 * Manages all onboarding state and logic in one place.
 * The builder component just needs to:
 * 1. Pass server progress + current state
 * 2. Render JobPasteModal and SpotlightOverlay with props from this hook
 * 3. Connect tailor handlers
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import type { GettingStartedProgress, Job } from '@prisma/client'
import type { Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import { toast } from '~/components/ui/use-toast.ts'
import {
	getOnboardingStage,
	getSpotlightTarget,
	getSpotlightHint,
	type OnboardingStage,
} from '~/utils/onboarding.ts'
import { track } from '~/lib/analytics.client.ts'

interface UseOnboardingFlowOptions {
	/** Server-side progress data from loader */
	serverProgress: Jsonify<GettingStartedProgress> | null
	/** Whether the user has a resume with content */
	hasResume: boolean
	/** The currently selected job (if any) */
	selectedJob: Jsonify<Job> | null | undefined
	/** Whether the tailor operation has completed this session */
	hasTailored: boolean
	/** Callback to set the selected job */
	onJobSelect: (job: Jsonify<Job>) => void
}

interface UseOnboardingFlowReturn {
	/** Current onboarding stage */
	stage: OnboardingStage
	/** Whether onboarding is complete */
	isComplete: boolean
	/** Whether to show the job paste modal */
	showJobModal: boolean
	/** Handler when job is created via modal */
	handleJobCreated: (job: Jsonify<Job>) => void
	/** Handler when user skips job modal */
	handleSkipJob: () => void
	/** CSS selector for spotlight target (or null) */
	spotlightTarget: string | null
	/** Hint text for spotlight (or null) */
	spotlightHint: string | null
	/** Whether to skip the diff modal (during onboarding) */
	skipDiffModal: boolean
	/** Handler to call when AI modal opens during onboarding */
	handleAIModalOpen: () => void
	/** Handler to call when AI modal closes during onboarding */
	handleAIModalClose: () => void
	/** Handler to call when user clicks "Tailor Achievement" - completes onboarding */
	handleTailorComplete: () => void
}

export function useOnboardingFlow({
	serverProgress,
	hasResume,
	selectedJob,
	hasTailored,
	onJobSelect,
}: UseOnboardingFlowOptions): UseOnboardingFlowReturn {
	const onboardingStartTime = useRef<number>(Date.now())

	// Local state for session-level overrides
	// These handle the case where server data is stale (action completed but loader hasn't refreshed)
	const [jobModalDismissed, setJobModalDismissed] = useState(false)
	const [sessionTailorComplete, setSessionTailorComplete] = useState(false)
	const [aiModalOpenDuringOnboarding, setAiModalOpenDuringOnboarding] = useState(false)

	// Compute current stage from all available data
	const { stage, isComplete } = useMemo(() => {
		// Session overrides take precedence for recently completed actions
		const effectiveHasTailored = hasTailored || sessionTailorComplete

		const baseStage = getOnboardingStage(
			serverProgress,
			hasResume,
			!!selectedJob,
			effectiveHasTailored,
		)

		// If we're at the bullet tailor stage and the AI modal is open, show the tailor click stage
		if (baseStage.stage === 'needs_bullet_tailor' && aiModalOpenDuringOnboarding) {
			return { stage: 'needs_tailor_click' as OnboardingStage, isComplete: false }
		}

		return baseStage
	}, [
		serverProgress,
		hasResume,
		selectedJob,
		hasTailored,
		sessionTailorComplete,
		aiModalOpenDuringOnboarding,
	])

	// Show job modal only when:
	// 1. Stage is needs_job
	// 2. User hasn't dismissed it this session
	const showJobModal = stage === 'needs_job' && !jobModalDismissed

	// Handle job creation from modal
	const handleJobCreated = useCallback(
		(job: Jsonify<Job>) => {
			setJobModalDismissed(true)
			onJobSelect(job)

			track('onboarding_step_completed', {
				step_name: 'job_added',
				step_number: 1,
				path: 'tailor',
			})

			toast({
				title: 'Job added!',
				description: 'Now improve your achievements with AI to match the job.',
			})
		},
		[onJobSelect],
	)

	// Handle skip - dismiss modal but don't select a job
	const handleSkipJob = useCallback(() => {
		setJobModalDismissed(true)
	}, [])

	// Handle AI modal open during onboarding (advances to needs_tailor_click stage)
	const handleAIModalOpen = useCallback(() => {
		setAiModalOpenDuringOnboarding(true)
	}, [])

	// Handle AI modal close during onboarding (reverts to needs_bullet_tailor if not completed)
	const handleAIModalClose = useCallback(() => {
		setAiModalOpenDuringOnboarding(false)
	}, [])

	// Handle tailor completion (called when user clicks "Tailor Achievement" - completes onboarding)
	const handleTailorComplete = useCallback(() => {
		setSessionTailorComplete(true)
		setAiModalOpenDuringOnboarding(false)

		track('onboarding_step_completed', {
			step_name: 'first_tailor',
			step_number: 2,
			path: 'tailor',
		})

		const durationSeconds = Math.round((Date.now() - onboardingStartTime.current) / 1000)
		track('onboarding_completed', {
			path: 'tailor',
			duration_seconds: durationSeconds,
		})

		toast({
			title: 'Great start!',
			description: 'Feel free to explore and tailor more achievements.',
		})
	}, [])

	// Spotlight configuration
	const spotlightTarget = useMemo(() => getSpotlightTarget(stage), [stage])
	const spotlightHint = useMemo(() => getSpotlightHint(stage), [stage])

	// During onboarding, skip the diff modal to keep flow simple
	// After onboarding (isComplete), show diff modal for power users
	const skipDiffModal = !isComplete

	return {
		stage,
		isComplete,
		showJobModal,
		handleJobCreated,
		handleSkipJob,
		spotlightTarget,
		spotlightHint,
		skipDiffModal,
		handleAIModalOpen,
		handleAIModalClose,
		handleTailorComplete,
	}
}
