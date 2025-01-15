import { Button } from './button.tsx'

interface ConfirmModalProps {
	isOpen: boolean
	onClose: () => void
	onConfirm: () => void
	title: string
	message: string
}

export function ConfirmModal({
	isOpen,
	onClose,
	onConfirm,
	title,
	message,
}: ConfirmModalProps) {
	if (!isOpen) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="w-[400px] rounded-lg bg-background p-6 shadow-lg">
				<h2 className="mb-4 text-lg font-semibold">{title}</h2>
				<p className="mb-6 text-muted-foreground">{message}</p>
				<div className="flex justify-end gap-2">
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button variant={'destructive'} onClick={onConfirm}>
						Create New
					</Button>
				</div>
			</div>
		</div>
	)
}
