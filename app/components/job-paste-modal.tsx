/**
 * Job Paste Modal
 *
 * Modal for first-time users to paste a job description during onboarding.
 * Wraps CreateJobModal with skip support.
 */

import { type Job } from '@prisma/client'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import { CreateJobModal } from '~/components/create-job-modal.tsx'

interface ThemeColors {
	bg: string
	bgEl: string
	bgSurf: string
	border: string
	borderSub: string
	text: string
	muted: string
	dim: string
}

interface JobPasteModalProps {
	isOpen: boolean
	onComplete: (job: Jsonify<Job>) => void
	onSkip: () => void
	theme?: ThemeColors
}

export function JobPasteModal({
	isOpen,
	onComplete,
	onSkip,
	theme,
}: JobPasteModalProps) {
	return (
		<CreateJobModal
			isOpen={isOpen}
			onClose={onSkip}
			onCreate={onComplete}
			theme={theme}
			showSkip
			onSkip={onSkip}
		/>
	)
}
