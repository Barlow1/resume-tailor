import { Menu } from '@headlessui/react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { Button } from './ui/button.tsx'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from './ui/tooltip.tsx'

interface Section {
	id: string
	label: string
	visible: boolean
}

interface SectionVisibilityMenuProps {
	sections: Section[]
	onToggleSection: (sectionId: string) => void
}

export function SectionVisibilityMenu({
	sections,
	onToggleSection,
}: SectionVisibilityMenuProps) {
	return (
		<Menu as="div" className="relative">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>
						<Menu.Button
							as={Button}
							className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-200"
						>
							<EyeIcon className="h-5 w-5" />
						</Menu.Button>
					</TooltipTrigger>
					<TooltipContent>Toggle section visibility</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<Menu.Items className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-lg border bg-background p-2 shadow-lg">
				{sections.map(section => (
					<Menu.Item key={section.id}>
						{({ active }) => (
							<button
								className={`${
									active ? 'bg-muted' : ''
								} flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm`}
								onClick={() => onToggleSection(section.id)}
							>
								{section.visible ? (
									<EyeIcon className="h-4 w-4" />
								) : (
									<EyeSlashIcon className="h-4 w-4 text-muted-foreground" />
								)}
								<span
									className={section.visible ? '' : 'text-muted-foreground'}
								>
									{section.label}
								</span>
							</button>
						)}
					</Menu.Item>
				))}
			</Menu.Items>
		</Menu>
	)
}
