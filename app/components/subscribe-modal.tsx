import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect } from 'react'
import { track, trackPaywallDismissed } from '~/lib/analytics.client.ts'
import { Pricing, type SubscribeTrigger } from '~/routes/resources+/pricing.tsx'
import { useTheme } from '~/routes/resources+/theme/index.tsx'

interface SubscribeModalProps {
	isOpen: boolean
	onClose: () => void
	successUrl: string
	cancelUrl: string
	redirectTo?: string
	trigger?: 'download_limit' | 'ai_limit' | 'analysis_limit' | 'outreach_limit' | 'upload_required'
}

interface ModalTokens {
	card: string
	text: string
	mut: string
	brd: string
	gradFrom: string
	gradMid: string
	gradTo: string
	brand: string
	closeHover: string
	modalShadow: string
	ambientGlow: string
}

const dark: ModalTokens = {
	card: '#111114',
	text: '#FAFAFA',
	mut: '#8E8E96',
	brd: 'rgba(255,255,255,0.06)',
	gradFrom: '#8B6AFF',
	gradMid: '#C4B5FD',
	gradTo: '#6B45FF',
	brand: '#6B45FF',
	closeHover: 'rgba(255,255,255,0.06)',
	modalShadow: '0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02)',
	ambientGlow: 'radial-gradient(ellipse at 50% 0%, rgba(107,69,255,0.15) 0%, transparent 65%)',
}

const light: ModalTokens = {
	card: '#FFFFFF',
	text: '#111113',
	mut: '#71717A',
	brd: '#E0E0E6',
	gradFrom: '#5430BB',
	gradMid: '#6B45FF',
	gradTo: '#5430BB',
	brand: '#6B45FF',
	closeHover: 'rgba(0,0,0,0.06)',
	modalShadow: '0 24px 48px rgba(17,17,19,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
	ambientGlow: 'radial-gradient(ellipse at 50% 0%, rgba(107,69,255,0.06) 0%, transparent 65%)',
}

export function SubscribeModal({
	isOpen,
	onClose,
	successUrl,
	cancelUrl,
	redirectTo,
	trigger,
}: SubscribeModalProps) {
	const theme = useTheme()
	const t = theme === 'light' ? light : dark

	useEffect(() => {
		if (isOpen) {
			track('pricing_page_viewed', { trigger: trigger ?? 'direct' })
		}
	}, [isOpen, trigger])

	const handleClose = () => {
		if (trigger) trackPaywallDismissed(trigger)
		onClose()
	}

	return (
		<Transition show={isOpen} as={Fragment} appear>
			<Dialog as="div" className="relative z-[200]" onClose={handleClose}>
				<Transition.Child
					as={Fragment}
					enter="ease-out duration-300"
					enterFrom="opacity-0"
					enterTo="opacity-100"
					leave="ease-in duration-200"
					leaveFrom="opacity-100"
					leaveTo="opacity-0"
				>
					<div
						style={{
							position: 'fixed',
							inset: 0,
							background: 'rgba(0,0,0,0.6)',
							backdropFilter: 'blur(8px)',
							WebkitBackdropFilter: 'blur(8px)',
						}}
					/>
				</Transition.Child>

				<div style={{ position: 'fixed', inset: 0, overflowY: 'auto' }}>
					<div
						style={{
							minHeight: '100%',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							padding: 16,
						}}
					>
						<Transition.Child
							as={Fragment}
							enter="ease-out duration-300"
							enterFrom="opacity-0 scale-95"
							enterTo="opacity-100 scale-100"
							leave="ease-in duration-200"
							leaveFrom="opacity-100 scale-100"
							leaveTo="opacity-0 scale-95"
						>
							<Dialog.Panel
								style={{
									position: 'relative',
									width: '100%',
									maxWidth: 760,
									maxHeight: 'calc(100vh - 32px)',
									background: t.card,
									border: `1px solid ${t.brd}`,
									borderRadius: 20,
									overflow: 'hidden',
									boxShadow: t.modalShadow,
									fontFamily: 'Nunito Sans, system-ui, sans-serif',
									display: 'flex',
									flexDirection: 'column',
								}}
							>
								<div
									aria-hidden="true"
									style={{
										position: 'absolute',
										inset: 0,
										pointerEvents: 'none',
										background: t.ambientGlow,
									}}
								/>

								<CloseButton onClose={handleClose} t={t} />

								<div
									style={{
										position: 'relative',
										zIndex: 1,
										padding: '36px 36px 32px',
										overflowY: 'auto',
										flex: '1 1 auto',
									}}
								>
									<Dialog.Title
										as="h2"
										style={{
											fontFamily: 'Manrope, Nunito Sans, system-ui, sans-serif',
											fontSize: 'clamp(28px, 4vw, 36px)',
											fontWeight: 700,
											letterSpacing: '-0.035em',
											lineHeight: 1.15,
											margin: '0 0 22px',
											color: t.text,
											textAlign: 'center',
											textWrap: 'balance' as const,
										}}
									>
										<span
											style={{
												background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradMid}, ${t.gradTo})`,
												WebkitBackgroundClip: 'text',
												WebkitTextFillColor: 'transparent',
												backgroundClip: 'text',
											}}
										>
											Upgrade
										</span>{' '}
										to Continue
									</Dialog.Title>

									<Pricing
										successUrl={successUrl}
										cancelUrl={cancelUrl}
										redirectTo={redirectTo}
										trigger={trigger as SubscribeTrigger | undefined}
									/>
								</div>
							</Dialog.Panel>
						</Transition.Child>
					</div>
				</div>
			</Dialog>
		</Transition>
	)
}

function CloseButton({ onClose, t }: { onClose: () => void; t: ModalTokens }) {
	return (
		<button
			type="button"
			onClick={onClose}
			aria-label="Close"
			style={{
				position: 'absolute',
				top: 16,
				right: 16,
				width: 28,
				height: 28,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'transparent',
				border: 'none',
				borderRadius: 999,
				color: t.mut,
				cursor: 'pointer',
				transition: 'all 0.15s',
				zIndex: 3,
				padding: 0,
			}}
			onMouseEnter={e => {
				e.currentTarget.style.background = t.closeHover
				e.currentTarget.style.color = t.text
			}}
			onMouseLeave={e => {
				e.currentTarget.style.background = 'transparent'
				e.currentTarget.style.color = t.mut
			}}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	)
}

export default SubscribeModal
