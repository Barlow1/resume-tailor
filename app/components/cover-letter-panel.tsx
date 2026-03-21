import { ChevronLeft, RefreshCw, Copy, Download } from 'lucide-react'
import type { ResumeData, BuilderJob } from '~/utils/builder-resume.server.ts'

interface CoverLetterPanelProps {
	open: boolean
	onClose: () => void
	formData: ResumeData
	selectedJob: BuilderJob | null
	theme: {
		bg: string
		bgEl: string
		bgSurf: string
		border: string
		text: string
		muted: string
		dim: string
		brandText: string
		white: string
		[key: string]: string
	}
	coverLetterText: string
	onTextChange: (text: string) => void
	onRegenerate: () => void
	isGenerating: boolean
}

export function CoverLetterPanel({
	open,
	onClose,
	formData,
	selectedJob,
	theme: c,
	coverLetterText,
	onTextChange,
	onRegenerate,
	isGenerating,
}: CoverLetterPanelProps) {
	if (!open) return null

	const handleCopy = () => {
		navigator.clipboard.writeText(coverLetterText)
	}

	const handleDownload = () => {
		const blob = new Blob([coverLetterText], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `cover-letter${selectedJob?.company ? `-${selectedJob.company}` : ''}.txt`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	const jobTitle = selectedJob?.title || 'this role'
	const company = selectedJob?.company || 'this company'

	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				background: c.bgEl,
				display: 'flex',
				flexDirection: 'column',
				zIndex: 10,
			}}
		>
			{/* Header */}
			<div
				style={{
					padding: '12px 16px',
					borderBottom: `1px solid ${c.border}`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<button
					onClick={onClose}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 8,
						background: 'none',
						border: 'none',
						cursor: 'pointer',
						color: c.muted,
						padding: 0,
					}}
				>
					<ChevronLeft size={14} strokeWidth={2} />
					<span
						style={{
							fontSize: 11,
							fontWeight: 700,
							textTransform: 'uppercase',
							letterSpacing: '0.06em',
						}}
					>
						Back to Assessment
					</span>
				</button>
				<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
					<button
						onClick={onRegenerate}
						disabled={isGenerating}
						title="Regenerate"
						style={{
							padding: 8,
							borderRadius: 8,
							border: 'none',
							background: 'transparent',
							cursor: isGenerating ? 'not-allowed' : 'pointer',
							color: c.dim,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							opacity: isGenerating ? 0.5 : 1,
						}}
						onMouseEnter={e => {
							;(e.currentTarget as HTMLButtonElement).style.background = c.bgSurf
						}}
						onMouseLeave={e => {
							;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
						}}
					>
						<RefreshCw size={16} strokeWidth={1.75} />
					</button>
					<button
						onClick={handleCopy}
						disabled={!coverLetterText}
						title="Copy"
						style={{
							padding: 8,
							borderRadius: 8,
							border: 'none',
							background: 'transparent',
							cursor: coverLetterText ? 'pointer' : 'not-allowed',
							color: c.dim,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							opacity: coverLetterText ? 1 : 0.5,
						}}
						onMouseEnter={e => {
							;(e.currentTarget as HTMLButtonElement).style.background = c.bgSurf
						}}
						onMouseLeave={e => {
							;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
						}}
					>
						<Copy size={16} strokeWidth={1.75} />
					</button>
					<button
						onClick={handleDownload}
						disabled={!coverLetterText}
						title="Download"
						style={{
							padding: 8,
							borderRadius: 8,
							border: 'none',
							background: 'transparent',
							cursor: coverLetterText ? 'pointer' : 'not-allowed',
							color: c.dim,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							opacity: coverLetterText ? 1 : 0.5,
						}}
						onMouseEnter={e => {
							;(e.currentTarget as HTMLButtonElement).style.background = c.bgSurf
						}}
						onMouseLeave={e => {
							;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
						}}
					>
						<Download size={16} strokeWidth={1.75} />
					</button>
				</div>
			</div>

			{/* Content */}
			<div
				style={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					padding: '24px 21px',
					overflow: 'auto',
				}}
			>
				<h2
					style={{
						fontSize: 24,
						fontWeight: 700,
						fontFamily: 'Manrope, sans-serif',
						color: c.text,
						margin: 0,
					}}
				>
					Cover Letter
				</h2>
				<p
					style={{
						fontSize: 14,
						color: c.muted,
						margin: '6px 0 20px',
					}}
				>
					Tailored for {jobTitle} at {company}
				</p>

				{isGenerating ? (
					<div
						style={{
							flex: 1,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 12,
						}}
					>
						<div
							style={{
								width: 24,
								height: 24,
								border: `2px solid ${c.border}`,
								borderTopColor: c.brandText,
								borderRadius: '50%',
								animation: 'cl-spin 0.8s linear infinite',
							}}
						/>
						<span style={{ fontSize: 14, color: c.muted }}>
							Generating...
						</span>
						<style>{`@keyframes cl-spin { to { transform: rotate(360deg) } }`}</style>
					</div>
				) : (
					<textarea
						value={coverLetterText}
						onChange={e => onTextChange(e.target.value)}
						placeholder="Your cover letter will appear here..."
						style={{
							flex: 1,
							fontFamily: 'Crimson Pro, Georgia, serif',
							background: c.white,
							border: `1px solid ${c.border}`,
							borderRadius: 4,
							padding: 40,
							fontSize: 14,
							lineHeight: 1.75,
							resize: 'none',
							color: c.text,
							outline: 'none',
							width: '100%',
							minHeight: 400,
						}}
					/>
				)}
			</div>
		</div>
	)
}
