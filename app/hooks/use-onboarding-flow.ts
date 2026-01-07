/**
 * Custom Hook: useOnboardingFlow
 *
 * Manages all onboarding state and logic in one place.
 * The builder component just needs to:
 * 1. Pass server progress + current state
 * 2. Render JobPasteModal and SpotlightOverlay with props from this hook
 * 3. Connect tailor/download handlers
 */

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@remix-run/react'
import type { GettingStartedProgress, Job } from '@prisma/client'
import type { Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import { toast } from '~/components/ui/use-toast.ts'
import {
	getOnboardingStage,
	getSpotlightTarget,
	getSpotlightHint,
	type OnboardingStage,
} from '~/utils/onboarding.ts'

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
	/** Handler to call after successful tailor */
	handleTailorComplete: () => void
	/** Handler to call after successful download */
	handleDownloadComplete: () => void
}

export function useOnboardingFlow({
	serverProgress,
	hasResume,
	selectedJob,
	hasTailored,
	onJobSelect,
}: UseOnboardingFlowOptions): UseOnboardingFlowReturn {
	const navigate = useNavigate()

	// Local state for session-level overrides
	// These handle the case where server data is stale (action completed but loader hasn't refreshed)
	const [jobModalDismissed, setJobModalDismissed] = useState(false)
	const [sessionTailorComplete, setSessionTailorComplete] = useState(false)
	const [sessionDownloadComplete, setSessionDownloadComplete] = useState(false)

	// Compute current stage from all available data
	const { stage, isComplete } = useMemo(() => {
		// Session overrides take precedence for recently completed actions
		const effectiveHasTailored = hasTailored || sessionTailorComplete
		const effectiveHasDownloaded =
			sessionDownloadComplete || (serverProgress?.downloadCount ?? 0) > 0

		if (effectiveHasDownloaded) {
			return { stage: 'complete' as OnboardingStage, isComplete: true }
		}

		return getOnboardingStage(
			serverProgress,
			hasResume,
			!!selectedJob,
			effectiveHasTailored,
		)
	}, [
		serverProgress,
		hasResume,
		selectedJob,
		hasTailored,
		sessionTailorComplete,
		sessionDownloadComplete,
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

			toast({
				title: 'Job added!',
				description: 'Now tailor your resume to match the job requirements.',
			})
		},
		[onJobSelect],
	)

	// Handle skip - dismiss modal but don't select a job
	const handleSkipJob = useCallback(() => {
		setJobModalDismissed(true)
	}, [])

	// Handle tailor completion
	const handleTailorComplete = useCallback(() => {
		setSessionTailorComplete(true)

		toast({
			title: 'Resume tailored!',
			description: 'Download your optimized resume now.',
		})
	}, [])

	// Handle download completion
	const handleDownloadComplete = useCallback(() => {
		setSessionDownloadComplete(true)

		// Refresh loader data to sync server state
		navigate('.', { replace: true })

		toast({
			title: 'Congratulations!',
			description: "You've completed the resume tailoring process.",
		})
	}, [navigate])

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
		handleTailorComplete,
		handleDownloadComplete,
	}
}
