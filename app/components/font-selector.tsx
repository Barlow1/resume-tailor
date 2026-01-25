'use client'

import {
	Listbox,
	ListboxButton,
	ListboxOption,
	ListboxOptions,
} from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline'

export type FontOption = {
	value: string
	label: string
}

const FONT_OPTIONS: FontOption[] = [
	{ value: 'font-crimson', label: 'Crimson Pro' },
	{ value: 'font-sans', label: 'Arial' },
	{ value: 'font-serif', label: 'Georgia' },
	{ value: 'font-mono', label: 'Courier' },
	{ value: 'font-garamond', label: 'Garamond' },
	{ value: 'font-trebuchet', label: 'Trebuchet' },
	{ value: 'font-verdana', label: 'Verdana' },
]

export function FontSelector({
	selectedFont,
	onFontChange,
}: {
	selectedFont: string
	onFontChange: (font: string) => void
}) {
	const selectedOption = FONT_OPTIONS.find(opt => opt.value === selectedFont)

	return (
		<Listbox value={selectedFont} onChange={onFontChange}>
			<div className="relative">
				<ListboxButton className="grid w-full min-w-[110px] cursor-default grid-cols-1 rounded-md bg-white py-1.5 pl-3 pr-2 text-left text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-brand-800 sm:text-sm/6">
					<span className={`col-start-1 row-start-1 truncate pr-6 ${selectedFont}`}>
						{selectedOption?.label ?? 'Choose a font...'}
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
					{FONT_OPTIONS.map(font => (
						<ListboxOption
							key={font.value}
							value={font.value}
							className="group relative cursor-default select-none py-2 pl-6 pr-9 text-gray-900 data-[focus]:bg-brand-800 data-[focus]:text-white data-[focus]:outline-none"
						>
							{({ selected }) => (
								<>
									<span className="absolute inset-y-0 left-1 flex items-center pr-4 text-brand-800 group-[&:not([data-selected])]:hidden group-data-[focus]:text-white">
										<CheckIcon aria-hidden="true" className="h-5 w-5" />
									</span>
									<span
										className={`block truncate font-normal group-data-[selected]:font-semibold ${font.value}`}
									>
										{font.label}
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

export { FONT_OPTIONS } 
export default FontSelector