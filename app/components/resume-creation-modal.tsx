import { useFetcher } from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import { type ResumeData } from '~/utils/builder-resume.server.ts'
import { X, FilePlus, Upload, Copy, Loader2, ChevronRight, Check } from 'lucide-react'

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
	borderSub: '#EBEBEF', text: '#111113', muted: '#46464C', dim: '#4A4A50',
}

interface ResumeCreationModalProps {
	isOpen: boolean
	onClose: () => void
	onStartScratch: () => void
	resumes: ResumeData[] | null
	userId: string | null
	handleUploadResume: () => boolean
	hasActiveSubscription?: boolean
	theme?: ThemeColors
}

export function ResumeCreationModal({
	isOpen,
	onClose,
	onStartScratch,
	resumes,
	userId,
	handleUploadResume,
	hasActiveSubscription = false,
	theme,
}: ResumeCreationModalProps) {
	const c = theme ?? defaultTheme
	const fetcher = useFetcher()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null)
	const [showResumes, setShowResumes] = useState(false)
	const [uploadError, setUploadError] = useState<string | null>(null)

	const isSubmitting = fetcher.state !== 'idle'

	const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
	const ALLOWED_TYPES = [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	]
	const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx']

	// Watch fetcher.data for server errors. If the server returned a paywall
	// (e.g. someone bypassed the client gate), close the modal so the parent
	// can surface the SubscribeModal instead of showing a red error banner.
	useEffect(() => {
		if (fetcher.data && typeof fetcher.data === 'object') {
			const data = fetcher.data as { error?: string; type?: string }
			if (data.type === 'subscription_required') {
				onClose()
				return
			}
			if (data.error) {
				setUploadError(data.error)
			}
		}
	}, [fetcher.data, onClose])

	// Auto-clear error after 10 seconds
	useEffect(() => {
		if (!uploadError) return
		const timer = setTimeout(() => setUploadError(null), 10_000)
		return () => clearTimeout(timer)
	}, [uploadError])

	// Clear error when modal closes
	useEffect(() => {
		if (!isOpen) setUploadError(null)
	}, [isOpen])

	const handleClickUpload = () => {
		const isLoggedInAndHasSubscription = handleUploadResume()
		if (isLoggedInAndHasSubscription) {
			fileInputRef.current?.click()
		}
	}

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		setUploadError(null)

		// Client-side file size validation
		if (file.size > MAX_FILE_SIZE) {
			setUploadError('File exceeds 5MB limit')
			if (fileInputRef.current) fileInputRef.current.value = ''
			return
		}

		// Client-side file type validation
		const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
		if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
			setUploadError('Please upload a PDF or DOCX file')
			if (fileInputRef.current) fileInputRef.current.value = ''
			return
		}

		const formData = new FormData()
		formData.append('resumeFile', file)

		fetcher.submit(formData, {
			method: 'POST',
			action: '/resources/create-resume?type=upload',
			encType: 'multipart/form-data',
		})
	}

	const handleUseExisting = () => {
		if (!selectedResumeId) return

		const formData = new FormData()
		formData.append('existingResumeId', selectedResumeId)

		fetcher.submit(formData, {
			method: 'POST',
			action: '/resources/create-resume?type=existing',
		})
	}

	if (!isOpen) return null

	const optionStyle = (hovered?: boolean): React.CSSProperties => ({
		padding: '14px 16px',
		borderRadius: 8,
		border: `1px solid ${c.border}`,
		background: hovered ? c.bgSurf : 'transparent',
		cursor: isSubmitting ? 'not-allowed' : 'pointer',
		display: 'flex',
		alignItems: 'center',
		gap: 12,
		transition: 'background 150ms',
		opacity: isSubmitting ? 0.5 : 1,
	})

	return (
		<div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
			<div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />

			<div style={{
				position: 'relative',
				width: '100%',
				maxWidth: 480,
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
							<FilePlus size={15} color={BRAND} strokeWidth={2} />
						</div>
						<span style={{ fontSize: 16, fontWeight: 600, color: c.text }}>Create Your Resume</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: c.dim, background: 'transparent', border: 'none', padding: 0 }}
						onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = c.bgSurf }}
						onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
					>
						<X size={16} strokeWidth={2} />
					</button>
				</div>

				{/* Body */}
				<div style={{ padding: '20px' }}>
					<p style={{ fontSize: 13, color: c.muted, marginBottom: 16 }}>Choose how to start</p>

					<input
						type="file"
						ref={fileInputRef}
						style={{ display: 'none' }}
						onChange={handleFileChange}
						accept=".doc, .docx, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/pdf, image/png, image/jpeg, .txt"
					/>

					{uploadError && (
						<div style={{
							background: '#FEE2E2',
							color: '#991B1B',
							borderRadius: 8,
							padding: '10px 14px',
							marginBottom: 6,
							fontSize: 13,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: 10,
						}}>
							<span>{uploadError}</span>
							<button
								type="button"
								onClick={() => {
									setUploadError(null)
									if (fileInputRef.current) fileInputRef.current.value = ''
									fileInputRef.current?.click()
								}}
								style={{
									background: 'transparent',
									border: 'none',
									color: '#991B1B',
									fontWeight: 600,
									fontSize: 13,
									cursor: 'pointer',
									whiteSpace: 'nowrap',
									textDecoration: 'underline',
									padding: 0,
								}}
							>
								Try again
							</button>
						</div>
					)}

					<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						{!showResumes && (
							<>
								{/* Start from scratch */}
								<div
									onClick={() => { if (!isSubmitting) { onStartScratch(); onClose() } }}
									style={optionStyle()}
									onMouseEnter={e => { if (!isSubmitting) (e.currentTarget as HTMLElement).style.background = c.bgSurf }}
									onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
								>
									<div style={{ width: 32, height: 32, borderRadius: 8, background: `${BRAND}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
										<FilePlus size={16} color={BRAND} strokeWidth={2} />
									</div>
									<div style={{ flex: 1 }}>
										<div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>Start from scratch</div>
										<div style={{ fontSize: 12, color: c.dim, marginTop: 2 }}>Begin with a blank resume and build it step by step</div>
									</div>
									<ChevronRight size={16} color={c.dim} style={{ flexShrink: 0 }} />
								</div>

								{/* Upload — Pro feature, rainbow-bordered when not subscribed */}
								<div
									className={!hasActiveSubscription ? 'animate-rainbow-border' : ''}
									style={!hasActiveSubscription ? { padding: 2, borderRadius: 10 } : undefined}
								>
									<div
										onClick={() => { if (!isSubmitting) handleClickUpload() }}
										style={{
											...optionStyle(),
											...(hasActiveSubscription
												? null
												: { background: c.bgEl, border: 'none', position: 'relative', zIndex: 1 }),
										}}
										onMouseEnter={e => { if (!isSubmitting) (e.currentTarget as HTMLElement).style.background = hasActiveSubscription ? c.bgSurf : c.bgEl }}
										onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = hasActiveSubscription ? 'transparent' : c.bgEl }}
									>
										<div style={{ width: 32, height: 32, borderRadius: 8, background: `${BRAND}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
											{isSubmitting
												? <Loader2 size={16} color={BRAND} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
												: <Upload size={16} color={BRAND} strokeWidth={2} />
											}
										</div>
										<div style={{ flex: 1 }}>
											<div style={{ fontSize: 14, fontWeight: 600, color: c.text, display: 'flex', alignItems: 'center', gap: 8 }}>
												{isSubmitting ? 'Uploading...' : 'Upload existing resume'}
												{!hasActiveSubscription && !isSubmitting ? (
													<span style={{
														fontSize: 10,
														fontWeight: 700,
														letterSpacing: 0.4,
														color: '#fff',
														background: 'linear-gradient(90deg, #6366f1 0%, #ec4899 100%)',
														borderRadius: 999,
														padding: '2px 7px',
														textTransform: 'uppercase',
													}}>Pro</span>
												) : null}
											</div>
											<div style={{ fontSize: 12, color: c.dim, marginTop: 2 }}>
												{isSubmitting ? 'Processing your resume, please wait...' : "Upload your current resume and we'll help you improve it"}
											</div>
										</div>
										{!isSubmitting && <ChevronRight size={16} color={c.dim} style={{ flexShrink: 0 }} />}
									</div>
								</div>

								{/* Use existing */}
								{resumes && resumes.length > 0 && (
									<div
										onClick={() => { if (!isSubmitting) setShowResumes(true) }}
										style={optionStyle()}
										onMouseEnter={e => { if (!isSubmitting) (e.currentTarget as HTMLElement).style.background = c.bgSurf }}
										onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
									>
										<div style={{ width: 32, height: 32, borderRadius: 8, background: `${BRAND}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
											<Copy size={16} color={BRAND} strokeWidth={2} />
										</div>
										<div style={{ flex: 1 }}>
											<div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>Use existing resume</div>
											<div style={{ fontSize: 12, color: c.dim, marginTop: 2 }}>Start with a previously created resume</div>
										</div>
										<ChevronRight size={16} color={c.dim} style={{ flexShrink: 0 }} />
									</div>
								)}
							</>
						)}

						{/* Resume picker */}
						{showResumes && resumes && resumes.length > 0 && (
							<div>
								<div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
									{resumes.map(r => {
										const selected = selectedResumeId === r.id
										return (
											<div
												key={r.id}
												onClick={() => setSelectedResumeId(r.id!)}
												style={{
													padding: '10px 12px',
													borderRadius: 7,
													border: `1px solid ${selected ? BRAND : c.border}`,
													background: selected ? `${BRAND}08` : 'transparent',
													cursor: 'pointer',
													display: 'flex',
													alignItems: 'center',
													gap: 10,
												}}
												onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = c.bgSurf }}
												onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
											>
												<div style={{
													width: 20, height: 20, borderRadius: 5,
													border: `1.5px solid ${selected ? BRAND : c.border}`,
													background: selected ? BRAND : 'transparent',
													display: 'flex', alignItems: 'center', justifyContent: 'center',
													flexShrink: 0,
												}}>
													{selected && <Check size={12} color="#fff" strokeWidth={3} />}
												</div>
												<div style={{ flex: 1, minWidth: 0 }}>
													<div style={{ fontSize: 14, fontWeight: 500, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
														{r.name || 'Untitled'}
													</div>
													<div style={{ fontSize: 12, color: c.dim }}>
														{r.job?.title || 'No target job'}
													</div>
												</div>
											</div>
										)
									})}
								</div>

								<div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
									<button
										type="button"
										onClick={() => { setShowResumes(false); setSelectedResumeId(null) }}
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
										Back
									</button>
									<button
										type="button"
										onClick={handleUseExisting}
										disabled={!selectedResumeId || isSubmitting}
										style={{
											flex: 1,
											padding: '10px 16px',
											fontSize: 14,
											fontWeight: 600,
											color: '#fff',
											background: !selectedResumeId ? `${BRAND}44` : BRAND,
											border: 'none',
											borderRadius: 8,
											cursor: !selectedResumeId ? 'not-allowed' : 'pointer',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											gap: 8,
										}}
										onMouseEnter={e => { if (selectedResumeId) (e.currentTarget as HTMLElement).style.background = '#5A35E0' }}
										onMouseLeave={e => { if (selectedResumeId) (e.currentTarget as HTMLElement).style.background = BRAND }}
									>
										Use Selected
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
			{isSubmitting && <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>}
		</div>
	)
}
