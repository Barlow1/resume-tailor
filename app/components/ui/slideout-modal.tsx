import { XMarkIcon } from '@heroicons/react/24/outline'

interface SlideoutModalProps {
	isOpen: boolean
	onClose: () => void
	title: React.ReactNode
	children: React.ReactNode
	side?: 'left' | 'right'
	width?: string
}

export function SlideoutModal({
	isOpen,
	onClose,
	title,
	children,
	side = 'right',
	width = '300px',
}: SlideoutModalProps) {
	if (!isOpen) return null

	return (
		<div
			className={`fixed inset-y-0 right-0 z-50 mt-[48px] h-[calc(100vh-48px)] transform overflow-hidden border-l border-border bg-background shadow-lg transition-transform duration-300 ease-in-out ${
				isOpen ? 'translate-x-0' : 'translate-x-full'
			}`}
			style={{ width }}
		>
			<div className="flex h-full flex-col">
				<div className="flex items-center justify-between border-b border-border p-4">
					{title}
					<button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>

				{children}
			</div>
		</div>
	)
}
