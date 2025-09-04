import * as React from 'react'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import {
	Link,
	useLoaderData,
	useNavigate,
	useRevalidator,
} from '@remix-run/react'
import { prisma } from '~/utils/db.server.ts'
import { KeywordPlan } from '~/components/keyword-plan.tsx'
import type { KeywordSnippet } from '~/lib/keywords/types.ts'

// ---------- Types (align with getAiFeedback) ----------
type ImproveItem = { current?: string; suggest: string; why: string }

type KeywordPlan = {
	term: string
	priority: 'critical' | 'important' | 'nice'
	where: Array<'skills' | 'summmary' | 'bullet'>
	supported: boolean
	proof?: string
	proofSuggestions?: string
	synonms?: string[]
	snippets?: { skills?: string; summary?: string; bullet?: string }
}

type Feedback = {
	fitPct: number
	summary: string
	redFlags?: string[]
	improveBullets?: ImproveItem[]
	keywords?: { resume: string[]; jd: string[]; missing: string[] }
	keywordBullets?: { suggest: string; why: string }[]
	keywordPlan?: { top10: KeywordSnippet[] }
}

type AnalysisRow = {
	id: string
	title: string
	company: string
	jdText: string
	resumeTxt: string | null
	fitPct: number | null
	feedback: string | null // JSON string
	createdAt: string | Date
	updatedAt: string | Date
}

type LoaderData = {
	analysis: AnalysisRow
	feedback: Feedback | null
}

const resumeKey = (id: string) => `analysis-resume-${id}`

// ---------- Loader: read from DB directly ----------
export async function loader({ params }: LoaderFunctionArgs) {
	const id = params.id!
	const analysis = await prisma.analysis.findUnique({
		where: { id },
		select: {
			id: true,
			title: true,
			company: true,
			jdText: true,
			resumeTxt: true,
			fitPct: true,
			feedback: true,
			createdAt: true,
			updatedAt: true,
		},
	})

	if (!analysis) throw new Response('Analysis not found', { status: 404 })

	let parsed: Feedback | null = null
	try {
		parsed = analysis.feedback
			? (JSON.parse(analysis.feedback) as Feedback)
			: null
	} catch {
		parsed = null
	}

	return json<LoaderData>({ analysis, feedback: parsed })
}

// ---------- Component ----------
export default function ResultsPage() {
	const { analysis, feedback } = useLoaderData<typeof loader>()
	const nav = useNavigate()
	const revalidator = useRevalidator()
	const cap = 5

	const [resumeTxt, setResumeTxt] = React.useState<string>(() => {
		if (typeof window === 'undefined') return analysis.resumeTxt ?? ''
		return (
			localStorage.getItem(resumeKey(analysis.id)) ?? analysis.resumeTxt ?? ''
		)
	})
	const [newFit, setNewFit] = React.useState<number | null>(null)
	const [reanalyzing, setReanalyzing] = React.useState(false)

	React.useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem(resumeKey(analysis.id), resumeTxt ?? '')
		}
	}, [analysis.id, resumeTxt])

	async function reanalyze() {
		setReanalyzing(true)
		try {
			const res = await fetch(`/resources/update-analysis/${analysis.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					// keep current job meta unless user changed it elsewhere
					title: analysis.title,
					company: analysis.company,
					jdText: analysis.jdText,
					resumeTxt,
				}),
			})

			if (res.status === 401) {
				nav(`/login?redirectTo=analyze/results/${analysis.id}`)
				return
			}
			if (res.status === 402) {
				// you can show your subscribe modal here if you want
				alert(
					'You’ve reached the free analysis limit. Please upgrade to continue.',
				)
				return
			}
			if (!res.ok) {
				const text = await res.text()
				throw new Error(text || `Re-analyze failed (${res.status})`)
			}

			// result shape from our update route: { analysis, feedback }
			const data = (await res.json()) as {
				analysis?: { fitPct?: number | null }
				feedback?: { fitPct?: number }
			}
			const nextFit =
				(typeof data.analysis?.fitPct === 'number'
					? data.analysis?.fitPct
					: null) ??
				(typeof data.feedback?.fitPct === 'number'
					? data.feedback.fitPct
					: null)

			setNewFit(nextFit ?? null)

			revalidator.revalidate()
		} catch (err) {
			console.error(err)
			alert('Re-analyze failed. Check server logs.')
		} finally {
			setReanalyzing(false)
		}
	}

	const improvements = feedback?.improveBullets ?? []
	const fit =
		typeof analysis.fitPct === 'number'
			? analysis.fitPct
			: feedback?.fitPct ?? null

	return (
		<div className="mx-auto max-w-5xl p-6">
			{/* Page header */}
			<header className="mb-6">
				<h1 className="mt-3 text-3xl font-bold tracking-tight">
					Results &amp; Edits
				</h1>
				<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
					Review your fit, scan red flags, and apply targeted edits below.
					Re-analyze anytime to see how your changes improve the score.
				</p>
			</header>

			{/* Results card */}
			<section className="rounded-2xl border border-border bg-card shadow-sm">
				<div className="rounded-t-2xl bg-gradient-to-r from-muted to-muted/80 px-5 py-3">
					<h2 className="text-sm font-semibold text-card-foreground">
						Analysis Summary
					</h2>
				</div>

				<div className="space-y-6 px-5 py-5">
					{/* Fit block */}
					<div>
						<div className="mb-2 flex items-center gap-3">
							<span className="text-base font-semibold text-foreground">
								Fit
							</span>
							<span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
								{fit != null ? `${fit}%` : '—'}
							</span>
							{newFit != null && (
								<span className="text-xs font-medium text-green-700">
									→ {newFit}%
								</span>
							)}
						</div>

						{/* Progress bar */}
						<div className="h-2 w-full overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border">
							<div
								className="h-full bg-primary transition-all"
								style={{
									width: `${Math.max(0, Math.min(100, newFit ?? fit ?? 0))}%`,
								}}
								aria-hidden="true"
							/>
						</div>
					</div>

					{/* Summary text */}
					{feedback?.summary && (
						<p className="text-sm leading-relaxed text-foreground">
							{feedback.summary}
						</p>
					)}

					{/* Red flags */}
					{feedback?.redFlags && feedback.redFlags.length > 0 && (
						<div>
							<h3 className="mb-2 text-sm font-semibold text-foreground">
								Red Flags
							</h3>
							<ul className="space-y-1.5 text-sm text-foreground">
								{feedback.redFlags.map((f, i) => (
									<li key={i} className="flex items-start gap-2">
										<span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
										<span>{f}</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* Improvements table */}
					<div>
						<h3 className="mb-2 text-sm font-semibold text-foreground">
							Improvements
						</h3>
						<div className="overflow-x-auto rounded-xl border border-border">
							<table className="min-w-full text-left text-sm">
								<thead className="bg-muted">
									<tr className="text-muted-foreground">
										<th className="px-3 py-2 font-semibold">Current</th>
										<th className="px-3 py-2 font-semibold">Suggestion</th>
										<th className="px-3 py-2 font-semibold">Why</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{improvements.length ? (
										improvements.map((b, i) => (
											<tr key={i} className="align-top">
												<td className="px-3 py-3 text-foreground">
													{b.current ?? ''}
												</td>
												<td className="px-3 py-3 text-foreground">
													{b.suggest}
												</td>
												<td className="px-3 py-3 text-foreground">{b.why}</td>
											</tr>
										))
									) : (
										<tr>
											<td
												className="px-3 py-3 italic text-muted-foreground"
												colSpan={3}
											>
												No suggestions yet.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
					{/* Top-10 Keyword Plan */}
					<KeywordPlan plan={feedback?.keywordPlan} />
					{/* Keyword Analyzer */}
					<div className="rounded-t-xl bg-muted px-5 py-3">
						<h2 className="text-sm font-semibold text-card-foreground">
							Keyword Analyzer
						</h2>
					</div>

					<div className="grid gap-4 px-5 py-4 md:grid-cols-3">
						<div>
							<div className="mb-2 text-xs font-medium text-muted-foreground">
								JD Keywords
							</div>
							<div className="flex flex-wrap gap-2">
								{(feedback?.keywords?.jd ?? []).slice(0, cap).map(k => (
									<span
										key={k}
										className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
									>
										{k}
									</span>
								))}
							</div>
						</div>
						<div>
							<div className="mb-2 text-xs font-medium text-muted-foreground">
								Resume Keywords
							</div>
							<div className="flex flex-wrap gap-2">
								{(feedback?.keywords?.resume ?? []).slice(0, cap).map(k => (
									<span
										key={k}
										className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
									>
										{k}
									</span>
								))}
							</div>
						</div>
						<div>
							<div className="mb-2 text-xs font-medium text-muted-foreground">
								Missing in Resume
							</div>
							<div className="flex flex-wrap gap-2">
								{(feedback?.keywords?.missing ?? []).slice(0, cap).map(k => (
									<span
										key={k}
										className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
									>
										{k}
									</span>
								))}
							</div>
						</div>
					</div>

					{!!feedback?.keywordBullets?.length && (
						<div className="px-5 pb-5">
							<div className="mb-2 text-sm font-semibold text-foreground">
								Keyword-focused Suggestions
							</div>
							<ul className="list-disc space-y-2 pl-6 text-sm text-foreground">
								{feedback!.keywordBullets!.map((b, i) => (
									<li key={i}>
										<div className="font-medium">{b.suggest}</div>
										<div className="text-xs text-muted-foreground">{b.why}</div>
									</li>
								))}
							</ul>
						</div>
					)}
					{/* Edit + Reanalyze */}
					<div>
						<h3 className="mb-2 text-sm font-semibold text-foreground">
							Edit Resume
						</h3>
						<textarea
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none ring-ring transition placeholder:text-muted-foreground focus:ring-4"
							rows={10}
							value={resumeTxt}
							onChange={e => setResumeTxt(e.target.value)}
							placeholder="Edit your resume text here…"
						/>

						<div className="mt-3 flex flex-wrap items-center gap-4">
							<button
								onClick={reanalyze}
								disabled={reanalyzing}
								aria-busy={reanalyzing}
								aria-live="polite"
								className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition
                  ${
										reanalyzing
											? 'cursor-not-allowed bg-primary/60 text-primary-foreground'
											: 'bg-primary text-primary-foreground hover:bg-primary/90'
									}`}
							>
								{reanalyzing && (
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
											d="M22 12a10 10 0 0 1-10 10"
											stroke="currentColor"
											strokeWidth="4"
											strokeLinecap="round"
										/>
									</svg>
								)}
								{reanalyzing ? 'Reanalyzing…' : 'Re-analyze'}
							</button>

							{newFit != null && (
								<span className="text-xs text-muted-foreground">
									Updated fit after re-analysis:{' '}
									<span className="font-semibold text-foreground">
										{newFit}%
									</span>
								</span>
							)}
						</div>
					</div>
				</div>
			</section>

			{/* Footer nav */}
			<div className="mt-6 flex flex-wrap gap-4">
				<Link
					to={`../../analyze/job/${analysis.id}`}
					className="text-sm text-muted-foreground underline-offset-4 hover:underline"
				>
					← Back to Job
				</Link>
				<Link
					to="../../analyze"
					className="text-sm text-muted-foreground underline-offset-4 hover:underline"
				>
					Start Over
				</Link>
			</div>
		</div>
	)
}
