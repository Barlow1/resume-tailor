import * as React from 'react'
import { useNavigate, Link } from '@remix-run/react'

export default function ResumePage() {
	const [resumeTxt, setResumeTxt] = React.useState('')
	const [resumeData, setResumeData] = React.useState<any>(null)
	const [saving, setSaving] = React.useState(false)
	const [uploading, setUploading] = React.useState(false)
	const [uploadError, setUploadError] = React.useState('')
	const nav = useNavigate()

	async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0]
		if (!file) return

		setUploading(true)
		setUploadError('')

		try {
			const formData = new FormData()
			formData.append('resumeFile', file)

			const res = await fetch('/resources/parse-resume-for-analysis', {
				method: 'POST',
				body: formData,
			})

			if (!res.ok) {
				const errorData = (await res.json()) as { error?: string }
				throw new Error(errorData.error || 'Failed to parse resume')
			}

			const { resumeData: parsedData, resumeTxt: parsedTxt } = (await res.json()) as {
				resumeData: any
				resumeTxt: string
			}

			setResumeData(parsedData)
			setResumeTxt(parsedTxt)
		} catch (error: any) {
			console.error('Upload error:', error)
			setUploadError(error.message || 'Failed to upload resume')
		} finally {
			setUploading(false)
		}
	}

	async function handleSave(e: React.FormEvent) {
		e.preventDefault()
		setSaving(true)
		try {
			const res = await fetch('/resources/create-analysis', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ resumeTxt, resumeData }),
			})

			// ✅ force login if not authenticated
			if (res.status === 401) {
				// bounce back to this page after login
				nav(`/login?redirectTo=/analyze`)
				return
			}

			// You may keep a free/paid gate ONLY for "analyze", not "save".
			// If your server accidentally returns 402 here, surface it:
			if (res.status === 402) {
				const text = await res.text()
				throw new Error(text || 'Upgrade required')
			}

			if (!res.ok) {
				// If the server sent an HTML error page, avoid .json() exploding
				const text = await res.text()
				throw new Error(`Save failed (${res.status}). ${text.slice(0, 200)}…`)
			}

			const data = (await res.json()) as { id: string }
			nav(`job/${data.id}`)
		} catch (e: any) {
			console.error(e)
			alert(e?.message || 'Failed to save resume. Check server logs.')
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="mx-auto max-w-5xl p-6">
			{/* Header */}
			<header className="mb-6">
				<h1 className="mt-3 text-3xl font-bold tracking-tight">
					Analyze Your Resume for Job Fit
				</h1>
				<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
					Upload your resume to see how well it matches a target job, uncover red
					flags, and get actionable improvements so your resume stands out.
				</p>
			</header>

			{/* Card */}
			<div className="rounded-2xl border border-border bg-card shadow-sm">
				<div className="rounded-t-2xl bg-gradient-to-r from-muted to-muted/80 px-5 py-3">
					<h2 className="text-sm font-semibold text-card-foreground">
						Upload Your Resume
					</h2>
				</div>

				<form onSubmit={handleSave} className="px-5 pb-5 pt-4">
					{/* File Upload Section */}
					<div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-8 text-center">
						<label
							htmlFor="resume-upload"
							className="inline-flex cursor-pointer flex-col items-center gap-3"
						>
							<div className="rounded-full bg-primary/10 p-4">
								{uploading ? (
									<svg
										className="h-8 w-8 animate-spin text-primary"
										viewBox="0 0 24 24"
										fill="none"
									>
										<circle
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
											opacity="0.25"
										/>
										<path
											d="M22 12a10 10 0 0 1-10 10"
											stroke="currentColor"
											strokeWidth="4"
											strokeLinecap="round"
										/>
									</svg>
								) : (
									<svg
										className="h-8 w-8 text-primary"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
										/>
									</svg>
								)}
							</div>
							<div>
								<p className="text-base font-semibold text-foreground">
									{uploading ? 'Uploading & Parsing...' : 'Click to upload resume'}
								</p>
								<p className="mt-1 text-sm text-muted-foreground">
									PDF, DOCX, DOC, or TXT (max 10MB)
								</p>
							</div>
						</label>
						<input
							id="resume-upload"
							type="file"
							accept=".pdf,.docx,.doc,.txt"
							onChange={handleFileUpload}
							disabled={uploading}
							className="hidden"
						/>

						{uploadError && (
							<div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
								{uploadError}
							</div>
						)}

						{resumeData && (
							<div className="mt-4 rounded-lg border border-green-500/50 bg-green-50 p-4 text-sm">
								<div className="flex items-start gap-3">
									<svg className="h-5 w-5 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
									</svg>
									<div className="flex-1 text-left">
										<p className="font-semibold text-green-900">Resume parsed successfully!</p>
										<ul className="mt-2 space-y-1 text-green-800">
											<li>• {resumeData.name || 'Name found'}</li>
											<li>• {resumeData.experiences?.length || 0} work experiences</li>
											<li>• {resumeData.education?.length || 0} education entries</li>
											<li>• {resumeData.skills?.length || 0} skills</li>
										</ul>
									</div>
								</div>
							</div>
						)}
					</div>

					<div className="mt-5 flex items-center gap-4">
						<button
							className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition
                ${
									saving || !resumeData
										? 'cursor-not-allowed bg-primary/60 text-primary-foreground'
										: 'bg-primary text-primary-foreground hover:bg-primary/90'
								}`}
							disabled={saving || !resumeData}
							aria-busy={saving}
							type="submit"
						>
							{saving && (
								<svg
									className="mr-2 h-4 w-4 animate-spin"
									viewBox="0 0 24 24"
									fill="none"
									aria-hidden="true"
								>
									<circle
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
										opacity="0.2"
									/>
									<path
										d="M22 12a10 10 0 0 1-10 10"
										stroke="currentColor"
										strokeWidth="4"
										strokeLinecap="round"
									/>
								</svg>
							)}
							{saving ? 'Saving…' : 'Continue to Job Details'}
						</button>

						<Link
							to="/"
							className="text-sm text-muted-foreground underline-offset-4 hover:underline"
						>
							Cancel
						</Link>
					</div>
				</form>
			</div>

			{/* Benefits row */}
			<ul className="mt-6 grid gap-3 text-sm text-foreground sm:grid-cols-3">
				<li className="flex items-center gap-2">
					<span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
					Get a clear fit score
				</li>
				<li className="flex items-center gap-2">
					<span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
					Spot red flags instantly
				</li>
				<li className="flex items-center gap-2">
					<span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
					Receive targeted improvements
				</li>
			</ul>
		</div>
	)
}
