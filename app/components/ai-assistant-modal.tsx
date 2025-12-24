import { useState, useEffect } from 'react'
import { Button } from '~/components/ui/button.tsx'
import { CheckIcon } from '@heroicons/react/24/outline'
import { cn } from '~/utils/misc.ts'
import { type GettingStartedProgress, type Subscription } from '@prisma/client'
import { SlideoutModal } from '~/components/ui/slideout-modal.tsx'
import {
	type BuilderExperience,
	type BuilderJob,
} from '~/utils/builder-resume.server.ts'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import { useFetcher } from '@remix-run/react'
import type OpenAI from 'openai'

interface AIAssistantModalProps {
	isOpen: boolean
	onClose: () => void
	onUpdate: (content: string) => void
	onMultipleUpdate: (contents: string[]) => void
	content?: string
	experience?: BuilderExperience
	job?: BuilderJob | null | undefined
	subscription: Subscription | null
	gettingStartedProgress: Jsonify<GettingStartedProgress> | null
	setShowSubscribeModal: (show: boolean) => void
}

export function AIAssistantModal({
	isOpen,
	onClose,
	onUpdate,
	onMultipleUpdate,
	content,
	experience,
	job,
	subscription,
	gettingStartedProgress,
	setShowSubscribeModal,
}: AIAssistantModalProps) {
	const [activeTab, setActiveTab] = useState<'tailor' | 'generate'>('tailor')
	const [selectedItems, setSelectedItems] = useState<number[]>([])
	const [rawContent, setRawContent] = useState<string>('')

	useEffect(() => {
		if (!isOpen) {
			setSelectedItems([])
		}
	}, [isOpen])

	const resetState = () => {
		setSelectedItems([])
		setRawContent('')
	}

	const builderCompletionsFetcher = useFetcher<
		OpenAI.Chat.Completions.ChatCompletion & {
			_request_id?: string | null
		}
	>()

	const handleCompletion = async (type: 'tailor' | 'generate') => {
		if (!subscription) {
			const MAX_AI_TRIAL_COUNT = 4
			const currentCount =
				(gettingStartedProgress?.generateCount ?? 0) +
				(gettingStartedProgress?.tailorCount ?? 0)
			if (currentCount >= MAX_AI_TRIAL_COUNT) {
				setShowSubscribeModal(true)
				return
			}
		}
		setSelectedItems([])

		const endpoint = type === 'tailor' ? 'experience' : 'generated-experience'
		const formData = new FormData()
		formData.append('jobTitle', job?.title ?? '')
		formData.append('jobDescription', job?.content ?? '')
		formData.append('currentJobTitle', experience?.role ?? '')
		formData.append('currentJobCompany', experience?.company ?? '')
		formData.append('experience', content ?? '')
		formData.append('type', endpoint)

		// Pass extracted keywords for better ATS optimization
		if (job?.extractedKeywords) {
			formData.append('extractedKeywords', job.extractedKeywords)
		}

		builderCompletionsFetcher.submit(formData, {
			method: 'POST',
			action: '/resources/builder-completions',
		})
	}

	useEffect(() => {
		if (builderCompletionsFetcher.state === 'idle' && builderCompletionsFetcher.data) {
			setRawContent(
				builderCompletionsFetcher.data?.choices[0].message.content ?? '{}',
			)
		}
	}, [builderCompletionsFetcher.state, builderCompletionsFetcher.data])

	let parsedOptions: string[] = []
	try {
		parsedOptions = rawContent
			? (JSON.parse(rawContent) as { experiences: string[] }).experiences ?? []
			: []
	} catch {
		// Invalid JSON from API - treat as empty
	}

	const isLoading = builderCompletionsFetcher.state === 'submitting'

	const handleItemSelect = (index: number) => {
		if (activeTab === 'tailor') {
			setSelectedItems([index])
		} else {
			setSelectedItems(prev =>
				prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index],
			)
		}
	}

	const handleSave = () => {
		const selectedContent = selectedItems
			.sort((a, b) => a - b)
			.map(index => parsedOptions[index])

		if (activeTab === 'tailor') {
			onUpdate(selectedContent[0])
		} else {
			onMultipleUpdate(selectedContent)
		}

		resetState()
		onClose()
	}

	const handleClose = () => {
		resetState()
		onClose()
	}

	return (
		<SlideoutModal
			isOpen={isOpen}
			onClose={handleClose}
			title={
				<h2
					className={cn(
						'text-xl font-semibold text-foreground transition-colors',
						isLoading && 'animate-rainbow-text',
					)}
				>
					AI Assistant
				</h2>
			}
		>
			<div className="border-b border-border">
				<div className="flex px-4">
					<button
						className={`px-4 py-3 ${
							activeTab === 'tailor'
								? 'border-b-2 border-primary text-primary'
								: 'text-muted-foreground'
						}`}
						onClick={() => {
							setActiveTab('tailor')
							setSelectedItems([])
							resetState()
						}}
					>
						Tailor
					</button>
					<button
						className={`px-4 py-3 ${
							activeTab === 'generate'
								? 'border-b-2 border-primary text-primary'
								: 'text-muted-foreground'
						}`}
						onClick={() => {
							setActiveTab('generate')
							setSelectedItems([])
							resetState()
						}}
					>
						Generate
					</button>
				</div>
			</div>

			<div className="flex flex-1 flex-col overflow-hidden">
				<div className="flex-shrink-0 space-y-4 p-4">
					<h3 className="font-medium text-foreground">Current Achievement</h3>
					<div className="rounded-lg border border-border bg-muted p-4">
						<p className="text-muted-foreground">{content}</p>
					</div>
				</div>

				<div className="flex-1 space-y-4 overflow-y-auto p-4">
					<div className="flex items-center justify-between">
						<h3 className="font-medium text-foreground">
							{activeTab === 'tailor'
								? 'Tailored Options'
								: 'Generated Options'}
						</h3>
						{selectedItems.length > 0 && (
							<span className="text-sm text-muted-foreground">
								{selectedItems.length} selected
							</span>
						)}
					</div>

					<div className="space-y-4">
						{!job ? (
							<div className="rounded-lg border border-border p-4">
								<p className="text-sm text-muted-foreground">
									Please select a job to get AI-powered suggestions.
								</p>
							</div>
						) : (
							<>
								<div className="rounded-lg border border-border p-4">
									<Button
										onClick={() => handleCompletion(activeTab)}
										disabled={isLoading}
										className={cn(
											'w-full',
											isLoading && 'animate-rainbow-text font-semibold',
										)}
									>
										{isLoading
											? 'Loading...'
											: activeTab === 'tailor'
											? 'Tailor Achievement'
											: 'Generate Achievements'}
									</Button>
								</div>
								<div className="space-y-2">
									{parsedOptions.length > 0 ? (
										<div className="space-y-2">
											{parsedOptions.map((option: string, index: number) => (
												<div
													key={index}
													onClick={() => handleItemSelect(index)}
													className={`group relative cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
														selectedItems.includes(index)
															? 'border-primary bg-accent'
															: 'border-border'
													}`}
												>
													<p className="pr-8 text-muted-foreground">{option}</p>
													{selectedItems.includes(index) && (
														<CheckIcon className="absolute right-2 top-2 h-5 w-5 text-primary" />
													)}
												</div>
											))}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											Click "
											{activeTab === 'tailor'
												? 'Tailor Achievement'
												: 'Generate Achievements'}
											" to get AI-powered suggestions...
										</p>
									)}
								</div>
							</>
						)}
					</div>
				</div>

				<div className="flex-shrink-0 border-t border-border bg-muted p-4">
					<div className="flex justify-start gap-2">
						<Button variant="secondary" onClick={handleClose}>
							Cancel
						</Button>
						{selectedItems.length > 0 && (
							<Button onClick={handleSave}>
								{activeTab === 'tailor'
									? 'Use Selected'
									: `Use ${selectedItems.length} Selected`}
							</Button>
						)}
					</div>
				</div>
			</div>
		</SlideoutModal>
	)
}
