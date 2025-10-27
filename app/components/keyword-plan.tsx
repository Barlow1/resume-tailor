// app/components/keyword-plan.tsx
import * as React from 'react'
import CopyButton from './copy-button.tsx'

// Off-screen but selectable textarea (must NOT be display:none)
function VisuallyHiddenTextarea({ id, value }: { id: string; value: string }) {
	return (
		<textarea
			id={id}
			value={value ?? ''}
			readOnly
			aria-hidden="true"
			className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px opacity-0"
			tabIndex={-1}
		/>
	)
}

// Make a CSS selector–safe id: letters/digits/_/-
function makeSafeId(prefix: string, term: string, index: number) {
	const safeTerm = (term || 'kw')
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, '-')
		.slice(0, 40)
	return `${prefix}-${index}-${safeTerm}`
}

export function KeywordPlan({
	plan,
	isLoading,
}: {
	plan: { top10: any[] } | undefined
	isLoading?: boolean
}) {
	const hasData = plan?.top10?.length > 0
	const showComponent = hasData || isLoading

	if (!showComponent) return null

	return (
		<section className="mt-6 rounded-xl border border-border bg-card shadow-sm">
			<div className="flex items-center justify-between rounded-t-xl bg-muted px-5 py-3">
				<h2 className="text-sm font-semibold text-card-foreground">
					Top 10 keywords to add for this job
				</h2>
			</div>

			<div className="divide-y divide-border">
				{hasData ? (
					plan.top10.map((k, i) => {
						const baseId = makeSafeId('kw', String(k.term ?? ''), i)
						const skillsId = `${baseId}-skills`
						const summaryId = `${baseId}-summary`
						const bulletId = `${baseId}-bullet`

						return (
							<div
								key={`${baseId}`}
								className="animate-in fade-in slide-in-from-left-2 grid gap-3 px-5 py-4 duration-300 md:grid-cols-5"
								style={{ animationDelay: `${i * 100}ms` }}
							>
								<div className="md:col-span-1">
									<div className="text-sm font-medium">{k.term}</div>
									<div className="text-xs text-muted-foreground">
										{k.priority}
									</div>
								</div>

								<div className="text-sm md:col-span-2">
									{k.supported ? (
										<div className="text-xs text-emerald-600 dark:text-emerald-400">
											✅ Supported: {k.proof}
										</div>
									) : (
										<div className="text-xs text-amber-600 dark:text-amber-400">
											⚠️ Needs proof: {k.proofSuggestion}
										</div>
									)}
								</div>

								<div className="flex flex-wrap gap-3 md:col-span-2">
									{k?.snippets?.skills && (
										<div className="rounded border border-border bg-muted px-2 py-1 text-xs">
											<VisuallyHiddenTextarea
												id={skillsId}
												value={k.snippets.skills}
											/>
											Skills:{' '}
											<span className="font-mono text-foreground">
												{k.snippets.skills}
											</span>
											<CopyButton inputId={skillsId} />
										</div>
									)}

									{k?.snippets?.summary && (
										<div className="rounded border border-border bg-muted px-2 py-1 text-xs">
											<VisuallyHiddenTextarea
												id={summaryId}
												value={k.snippets.summary}
											/>
											Summary:{' '}
											<span className="font-mono text-foreground">
												{k.snippets.summary}
											</span>
											<CopyButton inputId={summaryId} />
										</div>
									)}

									{k?.snippets?.bullet && (
										<div className="rounded border border-border bg-muted px-2 py-1 text-xs">
											<VisuallyHiddenTextarea
												id={bulletId}
												value={k.snippets.bullet}
											/>
											Bullet:{' '}
											<span className="font-mono text-foreground">
												{k.snippets.bullet}
											</span>
											<CopyButton inputId={bulletId} />
										</div>
									)}
								</div>
							</div>
						)
					})
				) : (
					// Skeleton loaders while streaming
					[...Array(3)].map((_, i) => (
						<div key={i} className="grid gap-3 px-5 py-4 md:grid-cols-5">
							<div className="md:col-span-1">
								<div className="mb-1 h-4 w-24 animate-pulse rounded bg-muted" />
								<div className="h-3 w-16 animate-pulse rounded bg-muted" />
							</div>
							<div className="md:col-span-2">
								<div className="h-4 w-full animate-pulse rounded bg-muted" />
							</div>
							<div className="flex flex-wrap gap-3 md:col-span-2">
								<div className="h-6 w-32 animate-pulse rounded bg-muted" />
								<div className="h-6 w-40 animate-pulse rounded bg-muted" />
							</div>
						</div>
					))
				)}
			</div>
		</section>
	)
}
