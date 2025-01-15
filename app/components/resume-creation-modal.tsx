import { Button } from './ui/button.tsx'
import { Icon } from './ui/icon.tsx'
import { SlideoutModal } from './ui/slideout-modal.tsx'
import { useFetcher } from '@remix-run/react'
import { useRef, useState } from 'react'
import { type ResumeData } from '~/utils/builder-resume.server.ts'
import {
	Listbox,
	ListboxButton,
	ListboxOption,
	ListboxOptions,
} from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline'
import moment from 'moment'

interface ResumeCreationModalProps {
	isOpen: boolean
	onClose: () => void
	resumes: ResumeData[] | null
}

export function ResumeCreationModal({
	isOpen,
	onClose,
	resumes,
}: ResumeCreationModalProps) {
	const fetcher = useFetcher()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null)
	const [showResumes, setShowResumes] = useState(false)

	const selectedResume = resumes?.find(r => r.id === selectedResumeId)

	const handleUploadResume = () => {
		fileInputRef.current?.click()
	}

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		const formData = new FormData()
		formData.append('resumeFile', file)

		fetcher.submit(formData, {
			method: 'POST',
			action: '/resources/create-resume?type=upload',
			encType: 'multipart/form-data',
		})
	}

	const handleUseExisting = () => {
		if (!selectedResumeId) return

		const formData = new FormData()
		formData.append('existingResumeId', selectedResumeId)

		fetcher.submit(formData, {
			method: 'POST',
			action: '/resources/create-resume?type=existing',
		})
	}

	const handleStartFresh = () => {
		onClose()
	}

	const handleShowResumes = () => {
		setShowResumes(true)
	}

	return (
		<SlideoutModal isOpen={isOpen} onClose={onClose} title="Create Your Resume">
			<input
				type="file"
				ref={fileInputRef}
				className="hidden"
				onChange={handleFileChange}
				accept=".doc, .docx, application/msword,
        application/vnd.openxmlformats-officedocument.wordprocessingml.document,
        application/pdf, application/msword, image/png, image/jpeg, .txt"
			/>

			<div className="flex flex-1 flex-col gap-6 p-6">
				<div className="space-y-2">
					<h3 className="text-lg font-semibold text-foreground">
						Choose how to start
					</h3>
					<p className="text-sm text-muted-foreground">
						Select one of the following options to begin creating your resume
					</p>
				</div>

				<div className="grid gap-4">
					{!showResumes ? (
						<>
							<Button
								onClick={handleStartFresh}
								variant="outline"
								className="flex h-auto flex-col items-start gap-1 p-4"
								disabled={fetcher.state !== 'idle'}
							>
								<div className="flex w-full items-center gap-2">
									<Icon name="plus" />
									<span className="flex-1 font-semibold">
										Start from scratch
									</span>
									<Icon name="arrow-right" className="text-muted-foreground" />
								</div>
								<p className="text-left text-sm text-muted-foreground">
									Begin with a blank resume and build it step by step
								</p>
							</Button>

							<Button
								onClick={handleUploadResume}
								variant="outline"
								className="flex h-auto flex-col items-start gap-1 p-4"
								disabled={fetcher.state !== 'idle'}
							>
								<div className="flex w-full items-center gap-2">
									<Icon name="upload" />
									<span className="flex-1 font-semibold">
										Upload existing resume
									</span>
									<Icon name="arrow-right" className="text-muted-foreground" />
								</div>
								<p className="text-left text-sm text-muted-foreground">
									Upload your current resume and we'll help you improve it
								</p>
							</Button>
						</>
					) : null}
					{resumes && resumes.length > 0 ? (
						<>
							{!showResumes ? (
								<Button
									onClick={handleShowResumes}
									variant="outline"
									className="flex h-auto flex-col items-start gap-1 p-4"
									disabled={fetcher.state !== 'idle'}
								>
									<div className="flex w-full items-center gap-2">
										<Icon name="copy" />
										<span className="flex-1 font-semibold">
											Use existing resume
										</span>
										<Icon
											name="arrow-right"
											className="text-muted-foreground"
										/>
									</div>
									<p className="text-left text-sm text-muted-foreground">
										Start with your previously tailored resume
									</p>
								</Button>
							) : null}
							{showResumes ? (
								<div className="space-y-4">
									<Listbox
										value={selectedResumeId}
										onChange={setSelectedResumeId}
									>
										<div className="relative mt-2">
											<ListboxButton className="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pl-3 pr-2 text-left text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-brand-800 sm:text-sm/6">
												<span className="col-start-1 row-start-1 truncate pr-6">
													{(selectedResume?.job?.title ||
														selectedResume?.name) ??
														'Choose a resume...'}
												</span>
												<ChevronUpDownIcon
													aria-hidden="true"
													className="col-start-1 row-start-1 h-5 w-5 self-center justify-self-end text-gray-500 sm:h-4 sm:w-4"
												/>
											</ListboxButton>

											<ListboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in sm:text-sm">
												{resumes?.map(resume => (
													<ListboxOption
														key={resume.id}
														value={resume.id}
														className="group relative cursor-default select-none py-2 pl-6 pr-9 text-gray-900 data-[focus]:bg-brand-800 data-[focus]:text-white data-[focus]:outline-none"
													>
														<span className="absolute inset-y-0 left-1 flex items-center pr-4 text-brand-800 group-[&:not([data-selected])]:hidden group-data-[focus]:text-white">
															<CheckIcon
																aria-hidden="true"
																className="h-5 w-5"
															/>
														</span>
														<div>
															<p className="block truncate font-normal group-data-[selected]:font-semibold">
																{resume.name || 'No name'}
															</p>
															<p className="block truncate font-normal group-data-[selected]:font-semibold">
																{resume.job?.title || 'No job title'}
															</p>
															<p className="font-xs font-gray-200 block truncate  group-data-[selected]:font-semibold">
																{moment(resume.updatedAt).format('MM/DD/YYYY')}
															</p>
														</div>
													</ListboxOption>
												))}
											</ListboxOptions>
										</div>
									</Listbox>

									<Button
										onClick={handleUseExisting}
										variant="outline"
										className="w-full"
										disabled={!selectedResumeId || fetcher.state !== 'idle'}
									>
										Use Selected Resume
									</Button>
								</div>
							) : null}
						</>
					) : null}
				</div>
			</div>
		</SlideoutModal>
	)
}
