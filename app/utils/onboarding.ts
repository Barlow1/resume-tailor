/**
 * Onboarding stage calculation utilities
 *
 * Pure functions to determine onboarding state from server data.
 * No side effects, no state management - just logic.
 */

import type { GettingStartedProgress } from '@prisma/client'
import type { Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'

export type OnboardingStage =
	| 'needs_resume'
	| 'needs_job'
	| 'needs_match_review'
	| 'needs_first_action'
	| 'complete'

export interface OnboardingState {
	stage: OnboardingStage
	isComplete: boolean
}

/**
 * Calculate the current onboarding stage from server progress data.
 *
 * Flow:
 * 1. needs_resume - User hasn't created/uploaded a resume yet
 * 2. needs_job - Has resume, needs to add a target job
 * 3. needs_match_review - Has both, needs to review match analysis in Truth Panel
 * 4. needs_first_action - Has reviewed match, needs to take a first action (e.g. generate cover letter)
 * 5. complete - User has taken a first action, free to explore
 */
export function getOnboardingStage(
	progress: Jsonify<GettingStartedProgress> | null,
	hasResume: boolean,
	hasJob: boolean,
	hasReviewedMatch: boolean,
	hasTakenAction: boolean,
): OnboardingState {
	// If user has taken a first action, onboarding is complete
	if (hasTakenAction) {
		return { stage: 'complete', isComplete: true }
	}

	// Also complete if user has downloaded (legacy check)
	if (progress?.downloadCount && progress.downloadCount > 0) {
		return { stage: 'complete', isComplete: true }
	}

	// Step 1: Need a resume
	if (!hasResume) {
		return { stage: 'needs_resume', isComplete: false }
	}

	// Step 2: Need a job description
	if (!hasJob) {
		return { stage: 'needs_job', isComplete: false }
	}

	// Step 3: Need to review match in Truth Panel
	if (!hasReviewedMatch) {
		return { stage: 'needs_match_review', isComplete: false }
	}

	// Step 4: Need to take a first action
	return { stage: 'needs_first_action', isComplete: false }
}

/**
 * Get the spotlight target selector for the current stage.
 * The new Truth Panel flow does not use spotlight overlays.
 */
export function getSpotlightTarget(_stage: OnboardingStage): string | null {
	return null
}

/**
 * Get the hint text for the current spotlight.
 * The new Truth Panel flow does not use spotlight hints.
 */
export function getSpotlightHint(_stage: OnboardingStage): string | null {
	return null
}
