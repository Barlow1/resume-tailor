import { useEffect, useRef } from 'react'
import { useFetcher } from '@remix-run/react'
import { type action as createJobAction } from '~/routes/resources+/create-job.tsx'
import { SlideoutModal } from '~/components/ui/slideout-modal.tsx'
import { type Job } from '@prisma/client'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'

interface CreateJobModalProps {
	isOpen: boolean
	onClose: () => void
	onCreate: (selectedJob: Jsonify<Job>) => void
}

export function CreateJobModal({ isOpen, onClose, onCreate }: CreateJobModalProps) {
	const fetcher = useFetcher<typeof createJobAction>()
	const formRef = useRef<HTMLFormElement>(null)

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'success' in fetcher.data && fetcher.data.success) {
			onClose()
			formRef.current?.reset()
			onCreate(fetcher.data.job)
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fetcher.state, fetcher.data])

	return (
		<SlideoutModal isOpen={isOpen} onClose={onClose} title="Create New Job">
			<fetcher.Form
				ref={formRef}
				method="post"
				action="/resources/create-job"
				className="flex flex-1 flex-col gap-4 p-4"
			>
				<div>
					<label htmlFor="title" className="mb-1 block text-sm font-medium">
						Job Title
					</label>
					<input
						type="text"
						id="title"
						name="title"
						className="w-full rounded border bg-transparent p-2"
						required
						placeholder="e.g. Frontend Developer"
					/>
				</div>

				<div className="flex-1">
					<label htmlFor="content" className="mb-1 block text-sm font-medium">
						Job Description
					</label>
					<textarea
						id="content"
						name="content"
						className="h-[calc(100vh-366px)] max-h-[calc(100vh-366px)] w-full rounded border bg-transparent p-2 overflow-y-auto"
						required
						placeholder="Enter the job description..."
					/>
				</div>

				<button
					type="submit"
					disabled={fetcher.state !== 'idle'}
					className="flex items-center justify-center gap-2 w-full rounded bg-brand-800 px-4 py-2 text-white transition hover:bg-brand-500 disabled:opacity-50"
				>
					{fetcher.state !== 'idle' && (
						<svg
							className="animate-spin h-5 w-5 text-white"
							xmlns="http://www.w3.org/2000/svg"
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
							></circle>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
					)}
					{fetcher.state !== 'idle' ? 'Creating...' : 'Create Job'}
				</button>
			</fetcher.Form>
		</SlideoutModal>
	)
}
