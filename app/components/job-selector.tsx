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
}: {
	jobs: Jsonify<Job>[]
	handleAddJob: () => void
	selectedJob: BuilderJob | null | undefined
	setSelectedJob: (job: Jsonify<Job>) => void
}) {
	return (
		<Listbox value={selectedJob} onChange={setSelectedJob}>
			<div className="relative mt-2">
				<ListboxButton className="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pl-3 pr-2 text-left text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-brand-800 sm:text-sm/6">
					<span className="col-start-1 row-start-1 truncate pr-6">
						{selectedJob?.title ?? 'Choose a job to tailor for...'}
					</span>
					<ChevronUpDownIcon
						aria-hidden="true"
						className="col-start-1 row-start-1 h-5 w-5 self-center justify-self-end text-gray-500 sm:h-4 sm:w-4"
					/>
				</ListboxButton>

				<ListboxOptions
					transition
					className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 ![color-scheme:light] focus:outline-none data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in sm:text-sm"
				>
					<ListboxOption
						defaultChecked={true}
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
					{/* Option to add a new job */}
					<ListboxOption
						value={null}
						className="group sticky bottom-0 cursor-default select-none bg-gray-200 py-2 pl-3 pr-9 text-gray-900 data-[focus]:bg-brand-800 data-[focus]:text-white data-[focus]:outline-none"
						onClick={handleAddJob}
					>
						<span className="flex items-center gap-2 truncate font-normal group-data-[selected]:font-semibold">
							<PlusIcon className="h-5 w-5" />
							Add a new job
						</span>
					</ListboxOption>
				</ListboxOptions>
			</div>
		</Listbox>
	)
}
