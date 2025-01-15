import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { Pricing } from '../routes/resources+/pricing.tsx'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface SubscribeModalProps {
	isOpen: boolean
	onClose: () => void
	successUrl: string
	cancelUrl: string
	redirectTo?: string
}

export function SubscribeModal({ isOpen, onClose, successUrl, cancelUrl, redirectTo }: SubscribeModalProps) {
	return (
		<Transition appear show={isOpen} as={Fragment}>
			<Dialog as="div" className="relative z-50" onClose={onClose}>
				<Transition.Child
					as={Fragment}
					enter="ease-out duration-300"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="ease-in duration-200"
					leaveFrom="opacity-100"
					leaveTo="opacity-0"
				>
					<div className="fixed inset-0 bg-black/25" />
				</Transition.Child>

				<div className="fixed inset-0 overflow-y-auto">
					<div className="flex min-h-full items-center justify-center p-4 text-center">
						<Transition.Child
							as={Fragment}
							enter="ease-out duration-300"
							enterFrom="opacity-0 scale-95"
							enterTo="opacity-100 scale-100"
							leave="ease-in duration-200"
							leaveFrom="opacity-100 scale-100"
							leaveTo="opacity-0 scale-95"
						>
							<Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-background p-6 text-left align-middle shadow-xl transition-all">
								<button
									type="button"
									onClick={onClose}
									className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
								>
									<XMarkIcon className="h-5 w-5" />
								</button>
								<Dialog.Title
									as="h3"
									className="text-3xl font-semibold leading-6 text-primary"
								>
									Upgrade to Continue
								</Dialog.Title>
								<div>
									<Pricing successUrl={successUrl} cancelUrl={cancelUrl} redirectTo={redirectTo} />
								</div>
							</Dialog.Panel>
						</Transition.Child>
					</div>
				</div>
			</Dialog>
		</Transition>
	)
}
