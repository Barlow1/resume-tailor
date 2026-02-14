import { useEffect, useRef } from 'react'
import { useFetcher } from '@remix-run/react'
import { type action as createJobAction } from '~/routes/resources+/create-job.tsx'
import { type Job } from '@prisma/client'
import { type Jsonify } from '@remix-run/server-runtime/dist/jsonify.js'
import { X, Briefcase, Loader2 } from 'lucide-react'

const BRAND = '#6B45FF'

interface ThemeColors {
	bg: string
	bgEl: string
	bgSurf: string
	border: string
	borderSub: string
	text: string
	muted: string
	dim: string
}

const defaultTheme: ThemeColors = {
	bg: '#FAFAFA', bgEl: '#FFFFFF', bgSurf: '#F4F4F5', border: '#E0E0E6',
	borderSub: '#EBEBEF', text: '#111113', muted: '#63636A', dim: '#9C9CA3',
}

interface CreateJobModalProps {
	isOpen: boolean
	onClose: () => void
	onCreate: (selectedJob: Jsonify<Job>) => void
	theme?: ThemeColors
	showSkip?: boolean
	onSkip?: () => void
}

export function CreateJobModal({ isOpen, onClose, onCreate, theme, showSkip, onSkip }: CreateJobModalProps) {
	const c = theme ?? defaultTheme
	const fetcher = useFetcher<typeof createJobAction>()
	const formRef = useRef<HTMLFormElement>(null)

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data && 'success' in fetcher.data && fetcher.data.success) {
			onClose()
			formRef.current?.reset()
			onCreate(fetcher.data.job)
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fetcher.state, fetcher.data])

	if (!isOpen) return null

	const isSubmitting = fetcher.state !== 'idle'

	return (
		<div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
			{/* Backdrop */}
			<div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />

			{/* Panel */}
			<div style={{
				position: 'relative',
				width: '100%',
				maxWidth: 520,
				margin: '0 16px',
				background: c.bgEl,
				border: `1px solid ${c.border}`,
				borderRadius: 12,
				boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
				overflow: 'hidden',
			}}>
				{/* Header */}
				<div style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '16px 20px',
					borderBottom: `1px solid ${c.border}`,
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
						<div style={{ width: 28, height: 28, borderRadius: 7, background: `${BRAND}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
							<Briefcase size={15} color={BRAND} strokeWidth={2} />
						</div>
						<span style={{ fontSize: 16, fontWeight: 600, color: c.text }}>Add Target Job</span>
					</div>
					<div
						onClick={onClose}
						style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: c.dim }}
						onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = c.bgSurf }}
						onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
					>
						<X size={16} strokeWidth={2} />
					</div>
				</div>

				{/* Body */}
				<fetcher.Form
					ref={formRef}
					method="post"
					action="/resources/create-job"
					style={{ padding: '20px' }}
				>
					<div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
						<div style={{ flex: 1 }}>
							<label htmlFor="title" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: c.muted, marginBottom: 6 }}>
								Job Title
							</label>
							<input
								type="text"
								id="title"
								name="title"
								required
								placeholder="e.g. Frontend Developer"
								style={{
									width: '100%',
									padding: '10px 12px',
									fontSize: 14,
									color: c.text,
									background: c.bgSurf,
									border: `1px solid ${c.border}`,
									borderRadius: 8,
									outline: 'none',
									boxSizing: 'border-box',
								}}
								onFocus={e => { e.currentTarget.style.borderColor = BRAND }}
								onBlur={e => { e.currentTarget.style.borderColor = c.border }}
							/>
						</div>
						<div style={{ flex: 1 }}>
							<label htmlFor="company" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: c.muted, marginBottom: 6 }}>
								Company
							</label>
							<input
								type="text"
								id="company"
								name="company"
								placeholder="e.g. Google"
								style={{
									width: '100%',
									padding: '10px 12px',
									fontSize: 14,
									color: c.text,
									background: c.bgSurf,
									border: `1px solid ${c.border}`,
									borderRadius: 8,
									outline: 'none',
									boxSizing: 'border-box',
								}}
								onFocus={e => { e.currentTarget.style.borderColor = BRAND }}
								onBlur={e => { e.currentTarget.style.borderColor = c.border }}
							/>
						</div>
					</div>

					<div style={{ marginBottom: 20 }}>
						<label htmlFor="content" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: c.muted, marginBottom: 6 }}>
							Job Description
						</label>
						<textarea
							id="content"
							name="content"
							required
							placeholder="Paste the job description here..."
							style={{
								width: '100%',
								height: 280,
								padding: '10px 12px',
								fontSize: 14,
								color: c.text,
								background: c.bgSurf,
								border: `1px solid ${c.border}`,
								borderRadius: 8,
								outline: 'none',
								resize: 'none',
								boxSizing: 'border-box',
								fontFamily: 'inherit',
								lineHeight: 1.5,
							}}
							onFocus={e => { e.currentTarget.style.borderColor = BRAND }}
							onBlur={e => { e.currentTarget.style.borderColor = c.border }}
						/>
					</div>

					<div style={{ display: 'flex', gap: 10 }}>
						{showSkip && onSkip && (
							<button
								type="button"
								onClick={onSkip}
								disabled={isSubmitting}
								style={{
									flex: 1,
									padding: '10px 16px',
									fontSize: 14,
									fontWeight: 500,
									color: c.muted,
									background: 'transparent',
									border: `1px solid ${c.border}`,
									borderRadius: 8,
									cursor: 'pointer',
								}}
								onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = c.bgSurf }}
								onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
							>
								Skip for now
							</button>
						)}
						<button
							type="submit"
							disabled={isSubmitting}
							style={{
								flex: 1,
								padding: '10px 16px',
								fontSize: 14,
								fontWeight: 600,
								color: '#fff',
								background: isSubmitting ? `${BRAND}88` : BRAND,
								border: 'none',
								borderRadius: 8,
								cursor: isSubmitting ? 'not-allowed' : 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: 8,
							}}
							onMouseEnter={e => { if (!isSubmitting) (e.currentTarget as HTMLElement).style.background = '#5A35E0' }}
							onMouseLeave={e => { if (!isSubmitting) (e.currentTarget as HTMLElement).style.background = BRAND }}
						>
							{isSubmitting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
							{isSubmitting ? 'Creating...' : 'Add Job'}
						</button>
					</div>
					{isSubmitting && <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>}
				</fetcher.Form>
			</div>
		</div>
	)
}
