import { Dialog } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Button } from './button.tsx'

interface DialogModalProps {
  isOpen: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl'
}

export function DialogModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}: DialogModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container for centering */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`${sizeClasses[size]} w-full rounded-lg bg-background p-6 shadow-xl`}>
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              {title}
            </Dialog.Title>
            <Button
              aria-label="close"
              name="close"
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="rounded-full p-1 hover:bg-muted"
            >
              <XMarkIcon className="h-5 w-5" />
            </Button>
          </div>

          <div className="mt-4">
            {children}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
} 