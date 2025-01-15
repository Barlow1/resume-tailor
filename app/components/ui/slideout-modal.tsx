import { XMarkIcon } from '@heroicons/react/24/outline'

interface SlideoutModalProps {
	isOpen: boolean
	onClose: () => void
	title: React.ReactNode
	children: React.ReactNode
}

export function SlideoutModal({
	isOpen,
	onClose,
	title,
	children,
}: SlideoutModalProps) {
	if (!isOpen) return null
    
	return (
		<div
			className={`fixed inset-y-0 right-0 z-50 mt-[66px] h-[calc(100vh-66px)] w-[300px] transform overflow-hidden bg-background shadow-lg transition-transform duration-300 ease-in-out dark:shadow-gray-700 ${
				isOpen ? 'translate-x-0' : 'translate-x-full'
			}`}
		>
			<div className="flex h-full flex-col">
				<div className="flex items-center justify-between border-b p-4">
					<h2 className="text-lg font-semibold">{title}</h2>
					<button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>

				{children}
			</div>
		</div>
	)
}
