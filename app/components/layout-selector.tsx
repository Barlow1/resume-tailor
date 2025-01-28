'use client'

import {
	Listbox,
	ListboxButton,
	ListboxOption,
	ListboxOptions,
} from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline'

export type LayoutOption = {
	value: string
	label: string
	description: string
}

export const LAYOUT_OPTIONS: LayoutOption[] = [
	{
		value: 'modern',
		label: 'Modern',
		description: 'Creative layout with a sidebar',
	},
	{
		value: 'professional',
		label: 'Professional',
		description: 'Clean and balanced design',
	},
	{
		value: 'traditional',
		label: 'Traditional',
		description: 'Classic single-column layout',
	},
]

export function LayoutSelector({
	selectedLayout,
	onLayoutChange,
}: {
	selectedLayout: string
	onLayoutChange: (layout: string) => void
}) {
	const selectedOption = LAYOUT_OPTIONS.find(opt => opt.value === selectedLayout)

	return (
		<Listbox value={selectedLayout} onChange={onLayoutChange}>
			<div className="relative">
				<ListboxButton className="grid w-full min-w-[120px] cursor-default grid-cols-1 rounded-md bg-white py-1.5 pl-3 pr-2 text-left text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-brand-800 sm:text-sm/6">
					<span className="col-start-1 row-start-1 truncate pr-6">
						{selectedOption?.label ?? 'Choose a layout...'}
					</span>
					<ChevronUpDownIcon
						aria-hidden="true"
						className="col-start-1 row-start-1 h-5 w-5 self-center justify-self-end text-gray-500 sm:h-4 sm:w-4"
					/>
				</ListboxButton>

				<ListboxOptions
					transition
					className="absolute z-10 mt-1 max-h-60 min-w-[250px] overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 ![color-scheme:light] focus:outline-none data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in sm:text-sm"
				>
					{LAYOUT_OPTIONS.map(layout => (
						<ListboxOption
							key={layout.value}
							value={layout.value}
							className="group relative cursor-default select-none py-2 pl-6 pr-9 text-gray-900 data-[focus]:bg-brand-800 data-[focus]:text-white data-[focus]:outline-none"
						>
							{({ selected }) => (
								<>
									<span className="absolute inset-y-0 left-1 flex items-center pr-4 text-brand-800 group-[&:not([data-selected])]:hidden group-data-[focus]:text-white">
										<CheckIcon aria-hidden="true" className="h-5 w-5" />
									</span>
									<div className="flex flex-col gap-0.5">
										<span className="block truncate font-normal group-data-[selected]:font-semibold">
											{layout.label}
										</span>
										<span className="block text-xs text-gray-500 group-data-[focus]:text-gray-200">
											{layout.description}
										</span>
									</div>
								</>
							)}
						</ListboxOption>
					))}
				</ListboxOptions>
			</div>
		</Listbox>
	)
}

export default LayoutSelector 