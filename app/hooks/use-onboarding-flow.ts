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
	/** Whether the user has reviewed match analysis in the Truth Panel this session */
	hasReviewedMatch: boolean
	/** Whether the user has taken a first action (e.g. generated cover letter) this session */
	hasTakenAction: boolean
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
	/** Reset onboarding state so user can replay the walkthrough */
	resetOnboarding: () => void
}

export function useOnboardingFlow({
	serverProgress,
	hasResume,
	selectedJob,
	hasReviewedMatch,
	hasTakenAction,
	onJobSelect,
}: UseOnboardingFlowOptions): UseOnboardingFlowReturn {
	const onboardingStartTime = useRef<number>(Date.now())

	// Local state for session-level overrides
	const [, setJobModalDismissed] = useState(false)
	const [sessionTailorComplete, setSessionTailorComplete] = useState(false)
	const [, setAiModalOpenDuringOnboarding] = useState(false)


	// Compute current stage from all available data
	const { stage, isComplete } = useMemo(() => {
		// Session overrides take precedence for recently completed actions
		const effectiveHasTakenAction = hasTakenAction || sessionTailorComplete

		return getOnboardingStage(
			serverProgress,
			hasResume,
			!!selectedJob,
			hasReviewedMatch,
			effectiveHasTakenAction,
		)
	}, [
		serverProgress,
		hasResume,
		selectedJob,
		hasReviewedMatch,
		hasTakenAction,
		sessionTailorComplete,
	])

	// #6: Don't auto-trigger the job modal when user starts typing.
	// The modal should only appear from explicit user action (e.g. "Add Target Job" command).
	const showJobModal = false

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

	// Reset onboarding so the walkthrough can be replayed
	const resetOnboarding = useCallback(() => {
		setJobModalDismissed(false)
		setSessionTailorComplete(false)
		setAiModalOpenDuringOnboarding(false)
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
		resetOnboarding,
	}
}
