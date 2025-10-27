import * as React from 'react'
import { useLoaderData, useNavigate, Link } from '@remix-run/react'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { SubscribeModal } from '~/components/subscribe-modal.tsx'

export async function loader({ params, request }: LoaderFunctionArgs) {
	const id = params.id!
	const origin = new URL(request.url).origin
	// This route should be implemented at app/routes/resources+/analysis.$id.tsx
	const apiUrl = new URL(`/resources/analysis/${id}`, origin)
	const res = await fetch(apiUrl)
	if (!res.ok)
		throw new Response(`Failed to load analysis ${id}`, { status: res.status })
	const data = await res.json()
	return json(data)
}

export default function JobPage() {
	const a = useLoaderData<any>()
	const nav = useNavigate()
	const [title, setTitle] = React.useState(a.title || '')
	const [company, setCompany] = React.useState(a.company || '')
	const [jdText, setJdText] = React.useState(a.jdText || '')
	const [analyzing, setAnalyzing] = React.useState(false)
	const [showSubscribe, setShowSubscribe] = React.useState(false)

	const resumePreview =
		(typeof window !== 'undefined' &&
			localStorage.getItem(`analysis-resume-${a.id}`)) ||
		a.resumeTxt ||
		''

	async function analyze(e: React.FormEvent) {
		e.preventDefault()
		setAnalyzing(true)

		try {
			// Check permissions before redirecting
			const checkRes = await fetch(`/resources/update-analysis/${a.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title,
					company,
					jdText,
					resumeTxt: resumePreview,
					dryRun: true,
				}),
			})

			if (checkRes.status === 401) {
				nav(`/login?redirectTo=/job/${a.id}`)
				return
			}
			if (checkRes.status === 402) {
				setShowSubscribe(true)
				setAnalyzing(false)
				return
			}

			// Save the inputs to localStorage for the results page to pick up
			if (typeof window !== 'undefined') {
				localStorage.setItem(`analysis-streaming-${a.id}`, JSON.stringify({
					title,
					company,
					jdText,
					resumeTxt: resumePreview,
				}))
			}

			// Immediately redirect to results page with streaming flag
			nav(`../../analyze/results/${a.id}?streaming=true`)
		} catch (err) {
			console.error(err)
			alert('Analyze failed. Check server logs.')
			setAnalyzing(false)
		}
	}

	return (
		<div className="mx-auto grid max-w-5xl gap-6 p-6 md:grid-cols-2">
			{/* left: form */}
			<div>
				<h1 className="mb-2 text-3xl font-bold">
					Add the Job You're Targeting
				</h1>
				<p className="text-muted-foreground">
					Paste the job title, company, and description. We'll compare it
					against your resume.
				</p>
				<form onSubmit={analyze} className="space-y-3">
					<input
						className="w-full rounded border border-input bg-background p-2 placeholder:text-muted-foreground"
						placeholder="Job Title"
						value={title}
						onChange={e => setTitle(e.target.value)}
					/>
					<input
						className="w-full rounded border border-input bg-background p-2 placeholder:text-muted-foreground"
						placeholder="Company"
						value={company}
						onChange={e => setCompany(e.target.value)}
					/>
					<textarea
						className="w-full rounded border border-input bg-background p-2 placeholder:text-muted-foreground"
						rows={10}
						placeholder="Paste the job description"
						value={jdText}
						onChange={e => setJdText(e.target.value)}
					/>
					<div className="flex items-center gap-3">
						<button
							className={`inline-flex items-center rounded px-4 py-2 transition ${
								analyzing
									? 'cursor-not-allowed bg-primary/60 text-primary-foreground opacity-60'
									: 'bg-primary text-primary-foreground hover:bg-primary/90'
							}`}
							disabled={analyzing}
							aria-busy={analyzing}
							aria-live="polite"
							type="submit"
						>
							{analyzing && (
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
										opacity="0.25"
									/>
									<path
										d="M22 12 a10 10 0 0 1-10 10"
										stroke="currentColor"
										strokeWidth="4"
										strokeLinecap="round"
									/>
								</svg>
							)}
							{analyzing ? 'Analyzing…' : 'Analyze'}
						</button>
						<Link
							to="/resume"
							className="text-muted-foreground hover:underline"
						>
							← Back
						</Link>
					</div>
				</form>
			</div>

			{/* right: resume snapshot */}
			<div>
				<h2 className="mb-2 font-semibold">Your Resume</h2>
				<pre className="whitespace-pre-wrap rounded border border-border bg-muted p-3 text-sm text-foreground">
					{resumePreview}
				</pre>
			</div>

			{/* paywall modal */}
			<SubscribeModal
				isOpen={showSubscribe}
				onClose={() => setShowSubscribe(false)}
				successUrl={`/resume`}
				redirectTo={`/resume`}
				cancelUrl={`/resume`}
			/>
		</div>
	)
}
