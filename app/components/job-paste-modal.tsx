/**
 * Job Paste Modal
 *
 * Modal for first-time users to paste a job description during onboarding.
 * Uses DialogModal for centered presentation.
 */

import { useEffect, useRef } from 'react'
import { useFetcher } from '@remix-run/react'
import { type Job } from '@prisma/client'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import { DialogModal } from '~/components/ui/dialog-modal.tsx'
import { Button } from '~/components/ui/button.tsx'
import { type action as createJobAction } from '~/routes/resources+/create-job.tsx'

interface JobPasteModalProps {
	isOpen: boolean
	onComplete: (job: Jsonify<Job>) => void
	onSkip: () => void
}

export function JobPasteModal({
	isOpen,
	onComplete,
	onSkip,
}: JobPasteModalProps) {
	const fetcher = useFetcher<typeof createJobAction>()
	const formRef = useRef<HTMLFormElement>(null)
	const hasCalledComplete = useRef(false)

	useEffect(() => {
		if (
			fetcher.state === 'idle' &&
			fetcher.data &&
			'success' in fetcher.data &&
			fetcher.data.success &&
			!hasCalledComplete.current
		) {
			hasCalledComplete.current = true
			formRef.current?.reset()
			onComplete(fetcher.data.job)
		}
	}, [fetcher.state, fetcher.data, onComplete])

	// Reset the flag when modal opens
	useEffect(() => {
		if (isOpen) {
			hasCalledComplete.current = false
		}
	}, [isOpen])

	const isSubmitting = fetcher.state !== 'idle'

	return (
		<DialogModal
			isOpen={isOpen}
			onClose={onSkip}
			title="Add a Job Description"
			size="lg"
		>
			<div className="space-y-4">
				<p className="text-sm text-gray-600">
					Paste a job description to tailor your resume. Our AI will optimize
					your resume to match the job requirements.
				</p>

				<fetcher.Form
					ref={formRef}
					method="post"
					action="/resources/create-job"
					className="space-y-4"
				>
					<div>
						<label
							htmlFor="job-title"
							className="mb-1 block text-sm font-medium"
						>
							Job Title
						</label>
						<input
							type="text"
							id="job-title"
							name="title"
							className="w-full rounded border border-gray-300 bg-transparent p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
							required
							placeholder="e.g. Senior Frontend Developer"
						/>
					</div>

					<div>
						<label
							htmlFor="job-content"
							className="mb-1 block text-sm font-medium"
						>
							Job Description
						</label>
						<textarea
							id="job-content"
							name="content"
							className="h-64 w-full rounded border border-gray-300 bg-transparent p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
							required
							placeholder="Paste the job description here..."
						/>
					</div>

					<div className="flex gap-3 pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={onSkip}
							className="flex-1"
							disabled={isSubmitting}
						>
							Skip for now
						</Button>
						<Button
							type="submit"
							disabled={isSubmitting}
							className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
						>
							{isSubmitting ? (
								<span className="flex items-center gap-2">
									<svg
										className="h-4 w-4 animate-spin"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											className="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										/>
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										/>
									</svg>
									Adding...
								</span>
							) : (
								'Add Job'
							)}
						</Button>
					</div>
				</fetcher.Form>
			</div>
		</DialogModal>
	)
}
