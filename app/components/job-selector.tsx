'use client'

import {
	Listbox,
	ListboxButton,
	ListboxOption,
	ListboxOptions,
} from '@headlessui/react'
import { type Job } from '@prisma/client'
import {
	ChevronUpDownIcon,
	CheckIcon,
	PlusIcon,
} from '@heroicons/react/24/outline'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import { type BuilderJob } from '~/utils/builder-resume.server.ts'

export default function JobSelector({
	jobs,
	handleAddJob,
	selectedJob,
	setSelectedJob,
	isActiveStep = false,
}: {
	jobs: Jsonify<Job>[]
	handleAddJob: () => void
	selectedJob: BuilderJob | null | undefined
	setSelectedJob: (job: Jsonify<Job>) => void
	isActiveStep?: boolean
}) {
	return (
		<Listbox value={selectedJob} onChange={setSelectedJob}>
			<div className="relative">
				<div className={isActiveStep ? 'animate-rainbow-border rounded-md' : ''}>
					<ListboxButton className={`grid w-full min-w-[200px] cursor-default grid-cols-1 ${isActiveStep ? 'relative z-[1] m-[2px] bg-white' : 'bg-white'} rounded-md py-1.5 pl-3 pr-2 text-left text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-brand-800 sm:text-sm/6`}>
						<span className="col-start-1 row-start-1 truncate pr-6">
							{selectedJob?.title ?? 'Choose a job to tailor for...'}
						</span>
						<ChevronUpDownIcon
							aria-hidden="true"
							className="col-start-1 row-start-1 h-5 w-5 self-center justify-self-end text-gray-500 sm:h-4 sm:w-4"
						/>
					</ListboxButton>
				</div>

				<ListboxOptions
					transition
					className="absolute z-10 mt-1 max-h-60 w-full flex flex-col overflow-hidden rounded-md bg-white text-base shadow-lg ring-1 ring-black/5 ![color-scheme:light] focus:outline-none data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in sm:text-sm"
				>
					<div className="overflow-auto py-1 flex-1">
						<ListboxOption
							value={null}
							className="group relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 data-[focus]:bg-brand-800 data-[focus]:text-white data-[focus]:outline-none"
						>
							<span className="block truncate font-normal group-data-[selected]:font-semibold">
								Choose a job to tailor for...
							</span>
						</ListboxOption>
						{jobs.map(job => (
							<ListboxOption
								key={job.id}
								value={job}
								className="group relative cursor-default select-none py-2 pl-6 pr-9 text-gray-900 data-[focus]:bg-brand-800 data-[focus]:text-white data-[focus]:outline-none"
							>
								<span className="absolute inset-y-0 left-1 flex items-center pr-4 text-brand-800 group-[&:not([data-selected])]:hidden group-data-[focus]:text-white">
									<CheckIcon aria-hidden="true" className="w-5 h-5" />
								</span>
								<span className="block truncate font-normal group-data-[selected]:font-semibold">
									{job.title}
								</span>
							</ListboxOption>
						))}
					</div>
					<div
						className="cursor-pointer select-none bg-gray-200 py-2 pl-3 pr-9 text-gray-900 hover:bg-brand-800 hover:text-white transition-colors border-t border-gray-300"
						onMouseDown={(e) => {
							e.preventDefault()
							e.stopPropagation()
						}}
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
							handleAddJob()
						}}
					>
						<span className="flex items-center gap-2 font-normal">
							<PlusIcon className="h-5 w-5" />
							Add a new job
						</span>
					</div>
				</ListboxOptions>
			</div>
		</Listbox>
	)
}
