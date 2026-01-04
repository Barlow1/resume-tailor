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
	| 'needs_tailor'
	| 'needs_download'
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
 * 2. needs_job - Has resume, needs to paste a job description
 * 3. needs_tailor - Has both, should click "Tailor to Job" button
 * 4. needs_download - Has tailored, should download the PDF
 * 5. complete - User has downloaded at least once
 */
export function getOnboardingStage(
	progress: Jsonify<GettingStartedProgress> | null,
	hasResume: boolean,
	hasJob: boolean,
	hasTailored: boolean,
): OnboardingState {
	// If user has downloaded at least once, onboarding is complete
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

	// Step 3: Need to tailor the resume
	if (!hasTailored) {
		return { stage: 'needs_tailor', isComplete: false }
	}

	// Step 4: Need to download
	return { stage: 'needs_download', isComplete: false }
}

/**
 * Get the spotlight target selector for the current stage
 */
export function getSpotlightTarget(stage: OnboardingStage): string | null {
	switch (stage) {
		case 'needs_tailor':
			return '#tailor-button'
		case 'needs_download':
			return '#download-button'
		default:
			return null
	}
}

/**
 * Get the hint text for the current spotlight
 */
export function getSpotlightHint(stage: OnboardingStage): string | null {
	switch (stage) {
		case 'needs_tailor':
			return 'Click to tailor your resume to the job description'
		case 'needs_download':
			return 'Download your tailored resume!'
		default:
			return null
	}
}
