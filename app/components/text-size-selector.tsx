'use client'

import {
	Listbox,
	ListboxButton,
	ListboxOption,
	ListboxOptions,
} from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline'
export type TextSizeOption = {
	value: string
	label: string
}

const TEXT_SIZE_OPTIONS: TextSizeOption[] = [
	{ value: 'small', label: 'Small' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'large', label: 'Large' },
]

export function TextSizeSelector({
	selectedTextSize,
	onTextSizeChange,
}: {
	selectedTextSize: string
	onTextSizeChange: (textSize: string) => void
}) {
	const selectedOption = TEXT_SIZE_OPTIONS.find(
		opt => opt.value === selectedTextSize,
	)

	return (
		<Listbox value={selectedTextSize} onChange={onTextSizeChange}>
			<div className="relative">
				<ListboxButton className="grid w-full min-w-[120px] cursor-default grid-cols-1 rounded-md bg-white py-1.5 pl-3 pr-2 text-left text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-brand-800 sm:text-sm/6">
					<span className="col-start-1 row-start-1 truncate pr-6">
						{selectedOption?.label ?? 'Choose a text size...'}
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
					{TEXT_SIZE_OPTIONS.map(textSize => (
						<ListboxOption
							key={textSize.value}
							value={textSize.value}
							className="group relative cursor-default select-none py-2 pl-6 pr-9 text-gray-900 data-[focus]:bg-brand-800 data-[focus]:text-white data-[focus]:outline-none"
						>
							{({ selected }) => (
								<>
									<span className="absolute inset-y-0 left-1 flex items-center pr-4 text-brand-800 group-[&:not([data-selected])]:hidden group-data-[focus]:text-white">
										<CheckIcon aria-hidden="true" className="h-5 w-5" />
									</span>
									<span className="block truncate font-normal group-data-[selected]:font-semibold">
										{textSize.label}
									</span>
								</>
							)}
						</ListboxOption>
					))}
				</ListboxOptions>
			</div>
		</Listbox>
	)
}

export { TEXT_SIZE_OPTIONS }
export default TextSizeSelector
