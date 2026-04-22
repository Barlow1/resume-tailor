import { json, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData, Form, Link } from '@remix-run/react'
import { useState } from 'react'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { prisma } from '~/utils/db.server.ts'
import { requireAdmin } from '~/utils/permissions.server.ts'

const PAGE_SIZE = 25

const LEVEL_RANK: Record<string, number> = { mismatch: 0, weak: 1, moderate: 2, strong: 3 }
const LEVEL_COLORS: Record<string, string> = {
	strong: '#16a34a',
	moderate: '#ca8a04',
	weak: '#dc2626',
	mismatch: '#991b1b',
}

function improvedStatus(
	before: { level: string; covered: number; total: number },
	after: { level: string; covered: number; total: number } | null,
): 'pending' | 'yes' | 'no' {
	if (!after) return 'pending'
	const beforeRank = LEVEL_RANK[before.level] ?? -1
	const afterRank = LEVEL_RANK[after.level] ?? -1
	if (afterRank > beforeRank) return 'yes'
	if (afterRank < beforeRank) return 'no'
	// Same level — compare ratios (not raw counts, since denominators can differ)
	const beforePct = before.total > 0 ? before.covered / before.total : 0
	const afterPct = after.total > 0 ? after.covered / after.total : 0
	if (afterPct > beforePct) return 'yes'
	return 'no'
}

export async function loader({ request }: DataFunctionArgs) {
	await requireAdmin(request)

	const url = new URL(request.url)
	const userEmail = url.searchParams.get('userEmail') ?? ''
	const improvedFilter = url.searchParams.get('improved') ?? 'all'
	const beforeLevelFilter = url.searchParams.get('beforeLevel') ?? 'all'
	const startDate = url.searchParams.get('startDate')
	const endDate = url.searchParams.get('endDate')
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))

	// Show ALL runs, not just those with fixes — so empty/untailored runs are visible too
	const runWhere: Record<string, unknown> = {}

	if (userEmail) {
		runWhere.user = { email: { contains: userEmail } }
	}

	if (beforeLevelFilter !== 'all') {
		runWhere.level = beforeLevelFilter
	}

	if (startDate || endDate) {
		const dateRange: Record<string, Date> = {}
		if (startDate) dateRange.gte = new Date(startDate)
		if (endDate) {
			const end = new Date(endDate)
			end.setDate(end.getDate() + 1)
			dateRange.lt = end
		}
		runWhere.createdAt = dateRange
	}

	const [triggeringRuns, totalCount] = await Promise.all([
		prisma.experienceMatchRun.findMany({
			where: runWhere,
			orderBy: { createdAt: 'desc' },
			take: PAGE_SIZE,
			skip: (page - 1) * PAGE_SIZE,
			include: {
				user: { select: { email: true, username: true } },
				resume: {
					select: {
						id: true,
						name: true,
						role: true,
						about: true,
						experiences: {
							select: {
								id: true,
								role: true,
								company: true,
								startDate: true,
								endDate: true,
								descriptions: { select: { id: true, content: true, order: true }, orderBy: { order: 'asc' } },
							},
							orderBy: { startDate: 'desc' },
						},
					},
				},
				job: { select: { id: true, title: true, company: true, content: true } },
				requirementFixes: { orderBy: { createdAt: 'asc' } },
			},
		}),
		prisma.experienceMatchRun.count({ where: runWhere }),
	])

	// A meaningful "after" is specifically a post_tailor run that fired for the same
	// resume+job AFTER this run, but BEFORE any later initial/manual_refresh run
	// (which would mark a new measurement session). post_tailor rows don't get an
	// "after" computed — they ARE the after of an earlier initial.
	const sessions = await Promise.all(
		triggeringRuns.map(async run => {
			if (run.triggeredBy === 'post_tailor') {
				return { run, afterRun: null, improved: null as null | 'yes' | 'no' }
			}

			// Pair by user+job (NOT resumeId), since the BuilderResume ID can change
			// across a tailor session (save regenerates it). The conceptual session is
			// "this user tailoring for this job".
			const nextBaseline = await prisma.experienceMatchRun.findFirst({
				where: {
					userId: run.userId,
					jobId: run.jobId,
					createdAt: { gt: run.createdAt },
					triggeredBy: { in: ['initial', 'manual_refresh'] },
				},
				orderBy: { createdAt: 'asc' },
				select: { createdAt: true },
			})

			const afterWhere: Record<string, unknown> = {
				userId: run.userId,
				jobId: run.jobId,
				triggeredBy: 'post_tailor',
				createdAt: { gt: run.createdAt },
			}
			if (nextBaseline) {
				;(afterWhere.createdAt as Record<string, Date>).lt = nextBaseline.createdAt
			}

			const afterRun = await prisma.experienceMatchRun.findFirst({
				where: afterWhere,
				orderBy: { createdAt: 'asc' },
				select: {
					id: true,
					level: true,
					requirementsCovered: true,
					requirementsTotal: true,
					triggeredBy: true,
					createdAt: true,
				},
			})

			const improved = afterRun
				? improvedStatus(
						{ level: run.level, covered: run.requirementsCovered, total: run.requirementsTotal },
						{
							level: afterRun.level,
							covered: afterRun.requirementsCovered,
							total: afterRun.requirementsTotal,
						},
					)
				: null

			return { run, afterRun, improved }
		}),
	)

	// Post-filter by improved (can't easily do in SQL since after-run is computed)
	const filteredSessions =
		improvedFilter === 'all'
			? sessions
			: improvedFilter === 'untailored'
				? sessions.filter(s => s.improved === null)
				: sessions.filter(s => s.improved === improvedFilter)

	const totalPages = Math.ceil(totalCount / PAGE_SIZE)

	return json({
		sessions: filteredSessions,
		userEmail,
		improvedFilter,
		beforeLevelFilter,
		startDate,
		endDate,
		page,
		totalPages,
		totalCount,
	})
}

function formatDate(dateStr: string | Date) {
	const d = new Date(dateStr)
	return d.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function safeJsonArray(s: string): string[] {
	try {
		const parsed = JSON.parse(s)
		return Array.isArray(parsed) ? (parsed as string[]) : []
	} catch {
		return []
	}
}

function safeJsonBestMoves(s: string): Array<{ type: string; headline: string; explanation?: string }> {
	try {
		const parsed = JSON.parse(s)
		if (!Array.isArray(parsed)) return []
		return parsed
			.filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
			.map(m => ({
				type: typeof m.type === 'string' ? m.type : '',
				headline: typeof m.headline === 'string' ? m.headline : '',
				explanation: typeof m.explanation === 'string' ? m.explanation : undefined,
			}))
	} catch {
		return []
	}
}

function ScoreBadge({ level, covered, total }: { level: string; covered: number; total: number }) {
	const color = LEVEL_COLORS[level] ?? '#666'
	return (
		<span
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: 4,
				padding: '2px 8px',
				borderRadius: 4,
				background: color,
				color: '#fff',
				fontSize: 12,
				fontWeight: 600,
			}}
		>
			{level} ({covered}/{total})
		</span>
	)
}

function ImprovedBadge({ improved }: { improved: 'pending' | 'yes' | 'no' | null }) {
	if (improved === null) {
		return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
	}
	const map = {
		yes: { bg: '#16a34a', label: 'improved ↑' },
		no: { bg: '#dc2626', label: 'no lift' },
		pending: { bg: '#94a3b8', label: 'pending' },
	}
	const { bg, label } = map[improved]
	return (
		<span
			style={{
				padding: '2px 8px',
				borderRadius: 4,
				background: bg,
				color: '#fff',
				fontSize: 12,
				fontWeight: 600,
			}}
		>
			{label}
		</span>
	)
}

export default function MatchHistoryPage() {
	const {
		sessions,
		userEmail,
		improvedFilter,
		beforeLevelFilter,
		startDate,
		endDate,
		page,
		totalPages,
		totalCount,
	} = useLoaderData<typeof loader>()
	const [expandedId, setExpandedId] = useState<string | null>(null)

	const exportParams = new URLSearchParams()
	if (userEmail) exportParams.set('userEmail', userEmail)
	if (improvedFilter !== 'all') exportParams.set('improved', improvedFilter)
	if (beforeLevelFilter !== 'all') exportParams.set('beforeLevel', beforeLevelFilter)
	if (startDate) exportParams.set('startDate', startDate)
	if (endDate) exportParams.set('endDate', endDate)
	const exportUrl = `/admin/match-history-export?${exportParams.toString()}`

	const buildPageUrl = (pageNum: number) => {
		const params = new URLSearchParams(exportParams)
		params.set('page', String(pageNum))
		return `/admin/match-history?${params.toString()}`
	}

	return (
		<div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
				<h1 style={{ fontSize: 24, fontWeight: 'bold' }}>Match History</h1>
				<a
					href={exportUrl}
					style={{
						padding: '8px 16px',
						background: '#16a34a',
						color: '#fff',
						borderRadius: 4,
						textDecoration: 'none',
						fontWeight: 500,
						display: 'flex',
						alignItems: 'center',
						gap: 6,
					}}
				>
					<ArrowDownTrayIcon style={{ width: 18, height: 18 }} />
					Export to Excel
				</a>
			</div>

			<Form method="get" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
				<div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
					<label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						User:
						<input
							type="text"
							name="userEmail"
							defaultValue={userEmail}
							placeholder="email contains..."
							style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, width: 220 }}
						/>
					</label>
					<label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						From:
						<input
							type="date"
							name="startDate"
							defaultValue={startDate ?? ''}
							style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4 }}
						/>
					</label>
					<label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						To:
						<input
							type="date"
							name="endDate"
							defaultValue={endDate ?? ''}
							style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4 }}
						/>
					</label>
					<button
						type="submit"
						style={{ padding: '6px 12px', background: '#333', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
					>
						Apply
					</button>
					{(userEmail || startDate || endDate || improvedFilter !== 'all' || beforeLevelFilter !== 'all') && (
						<Link to="/admin/match-history" style={{ color: '#666', fontSize: 14 }}>
							Clear all
						</Link>
					)}
				</div>

				<div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
					{userEmail && <input type="hidden" name="userEmail" value={userEmail} />}
					{startDate && <input type="hidden" name="startDate" value={startDate} />}
					{endDate && <input type="hidden" name="endDate" value={endDate} />}
					{beforeLevelFilter !== 'all' && <input type="hidden" name="beforeLevel" value={beforeLevelFilter} />}

					<span style={{ fontSize: 13, color: '#666' }}>Improved:</span>
					{['all', 'yes', 'no', 'pending'].map(v => (
						<button
							key={v}
							type="submit"
							name="improved"
							value={v}
							style={{
								padding: '4px 10px',
								border: '1px solid #ccc',
								borderRadius: 4,
								background: improvedFilter === v ? '#333' : '#fff',
								color: improvedFilter === v ? '#fff' : '#333',
								cursor: 'pointer',
								fontSize: 13,
							}}
						>
							{v}
						</button>
					))}
				</div>

				<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
					{userEmail && <input type="hidden" name="userEmail" value={userEmail} />}
					{startDate && <input type="hidden" name="startDate" value={startDate} />}
					{endDate && <input type="hidden" name="endDate" value={endDate} />}
					{improvedFilter !== 'all' && <input type="hidden" name="improved" value={improvedFilter} />}

					<span style={{ fontSize: 13, color: '#666' }}>Before level:</span>
					{['all', 'strong', 'moderate', 'weak', 'mismatch'].map(v => (
						<button
							key={v}
							type="submit"
							name="beforeLevel"
							value={v}
							style={{
								padding: '4px 10px',
								border: '1px solid #ccc',
								borderRadius: 4,
								background: beforeLevelFilter === v ? '#333' : '#fff',
								color: beforeLevelFilter === v ? '#fff' : '#333',
								cursor: 'pointer',
								fontSize: 13,
							}}
						>
							{v}
						</button>
					))}
				</div>
			</Form>

			<p style={{ marginBottom: 12, color: '#666' }}>
				Showing {sessions.length} of {totalCount} runs (page {page} of {totalPages || 1})
			</p>

			<table style={{ width: '100%', borderCollapse: 'collapse' }}>
				<thead>
					<tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left', fontSize: 13 }}>
						<th style={{ padding: 8 }}>When</th>
						<th style={{ padding: 8 }}>User</th>
						<th style={{ padding: 8 }}>Resume</th>
						<th style={{ padding: 8 }}>Job</th>
						<th style={{ padding: 8 }}>Trigger</th>
						<th style={{ padding: 8 }}>Score → Next</th>
						<th style={{ padding: 8 }}>Status</th>
						<th style={{ padding: 8 }}>Fixes</th>
					</tr>
				</thead>
				<tbody>
					{sessions.map(({ run, afterRun, improved }) => {
						const isExpanded = expandedId === run.id
						return (
							<>
								<tr
									key={run.id}
									onClick={() => setExpandedId(isExpanded ? null : run.id)}
									style={{ cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: 14 }}
								>
									<td style={{ padding: 8 }}>{formatDate(run.createdAt)}</td>
									<td style={{ padding: 8 }}>{run.user.email}</td>
									<td style={{ padding: 8 }}>
										{run.resume?.name || run.resume?.role || run.resumeId.slice(0, 8)}
									</td>
									<td style={{ padding: 8 }}>
										{run.job.title}
										{run.job.company ? ` @ ${run.job.company}` : ''}
									</td>
									<td style={{ padding: 8, fontSize: 12, color: '#666' }}>
										{run.triggeredBy}
										{run.cacheHit && <span style={{ marginLeft: 4, color: '#94a3b8' }}>(cache)</span>}
									</td>
									<td style={{ padding: 8 }}>
										<ScoreBadge
											level={run.level}
											covered={run.requirementsCovered}
											total={run.requirementsTotal}
										/>
										<span style={{ margin: '0 6px' }}>→</span>
										{afterRun ? (
											<ScoreBadge
												level={afterRun.level}
												covered={afterRun.requirementsCovered}
												total={afterRun.requirementsTotal}
											/>
										) : (
											<span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
										)}
									</td>
									<td style={{ padding: 8 }}>
										<ImprovedBadge improved={improved} />
									</td>
									<td style={{ padding: 8 }}>{run.requirementFixes.length}</td>
								</tr>
								{isExpanded && (
									<tr style={{ background: '#fafafa' }}>
										<td colSpan={8} style={{ padding: 16 }}>
											{(() => {
												const missing = safeJsonArray(run.missingRequirements)
												const covered = safeJsonArray(run.coveredRequirements)
												const bestMoves = safeJsonBestMoves(run.bestMoves)
												return (
													<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 16 }}>
														<div>
															<div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
																Covered ({covered.length})
															</div>
															<ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#16a34a' }}>
																{covered.map((c, i) => (
																	<li key={i}>{c}</li>
																))}
																{covered.length === 0 && <li style={{ color: '#999' }}>none</li>}
															</ul>
														</div>
														<div>
															<div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
																Missing ({missing.length})
															</div>
															<ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#dc2626' }}>
																{missing.map((m, i) => (
																	<li key={i}>{m}</li>
																))}
																{missing.length === 0 && <li style={{ color: '#999' }}>none</li>}
															</ul>
														</div>
														{bestMoves.length > 0 && (
															<div style={{ gridColumn: '1 / span 2' }}>
																<div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
																	AI best moves
																</div>
																<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
																	{bestMoves.map((m, i) => (
																		<div key={i} style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 4, padding: 10 }}>
																			<div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>
																				{m.headline} <span style={{ color: '#999', fontWeight: 400 }}>({m.type})</span>
																			</div>
																			{m.explanation && (
																				<div style={{ fontSize: 12, color: '#666', marginTop: 4, lineHeight: 1.4 }}>
																					{m.explanation}
																				</div>
																			)}
																		</div>
																	))}
																</div>
															</div>
														)}
														{run.job.content && (
															<details style={{ gridColumn: '1 / span 2' }}>
																<summary style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}>
																	Job description (click to expand)
																</summary>
																<pre
																	style={{
																		marginTop: 8,
																		fontSize: 12,
																		fontFamily: 'system-ui, sans-serif',
																		whiteSpace: 'pre-wrap',
																		background: '#fff',
																		border: '1px solid #e5e5e5',
																		borderRadius: 4,
																		padding: 10,
																		maxHeight: 300,
																		overflow: 'auto',
																	}}
																>
																	{run.job.content}
																</pre>
															</details>
														)}
														{run.resume && (
															<details style={{ gridColumn: '1 / span 2' }}>
																<summary style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}>
																	Resume snapshot — {run.resume.name || run.resume.role || run.resumeId.slice(0, 8)} (click to expand)
																</summary>
																<div style={{ marginTop: 8, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 4, padding: 10, maxHeight: 400, overflow: 'auto' }}>
																	<div style={{ fontSize: 10, color: '#999', marginBottom: 6, fontStyle: 'italic' }}>
																		Shows current resume state — may have been edited since the match ran.
																	</div>
																	{run.resume.about && (
																		<div style={{ marginBottom: 10 }}>
																			<div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 2 }}>About</div>
																			<div style={{ fontSize: 12, color: '#333', lineHeight: 1.5 }}>{run.resume.about}</div>
																		</div>
																	)}
																	{run.resume.experiences?.map(exp => (
																		<div key={exp.id} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
																			<div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>
																				{exp.role} <span style={{ fontWeight: 400, color: '#666' }}>at {exp.company}</span>
																				{(exp.startDate || exp.endDate) && (
																					<span style={{ fontSize: 11, fontWeight: 400, color: '#999', marginLeft: 8 }}>
																						{exp.startDate || '?'} – {exp.endDate || 'Present'}
																					</span>
																				)}
																			</div>
																			{exp.descriptions.length > 0 && (
																				<ul style={{ margin: '4px 0 0 0', paddingLeft: 20, fontSize: 12, color: '#444', lineHeight: 1.5 }}>
																					{exp.descriptions.map(d => (
																						<li key={d.id}>{d.content}</li>
																					))}
																				</ul>
																			)}
																		</div>
																	))}
																</div>
															</details>
														)}
													</div>
												)
											})()}
											{run.requirementFixes.length === 0 && (
												<div style={{ fontSize: 13, color: '#999', fontStyle: 'italic', padding: '8px 0' }}>
													No bullets were logged from a tailor session for this run.
												</div>
											)}
											<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
												{run.requirementFixes.map(fix => {
													const expLabel =
														(run.resume?.experiences ?? []).find(e => e.id === fix.experienceId) ??
														null
													return (
													<div
														key={fix.id}
														style={{
															border: '1px solid #e5e5e5',
															borderRadius: 6,
															padding: 12,
															background: '#fff',
														}}
													>
														<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
															<span
																style={{
																	padding: '2px 8px',
																	borderRadius: 4,
																	background: fix.bulletAction === 'new' ? '#0ea5e9' : '#8b5cf6',
																	color: '#fff',
																	fontSize: 11,
																	fontWeight: 600,
																}}
															>
																{fix.bulletAction}
															</span>
															<span style={{ fontSize: 13, color: '#666' }}>
																{expLabel ? `${expLabel.role} at ${expLabel.company}` : `exp: ${fix.experienceId.slice(0, 8)}`}
															</span>
														</div>
														<div style={{ fontSize: 13, color: '#333', marginBottom: 8 }}>
															<strong>Gap:</strong> {fix.requirement}
														</div>
														{fix.bulletAction === 'rewrite' && fix.previousBulletContent && (
															<div
																style={{
																	display: 'grid',
																	gridTemplateColumns: '1fr 1fr',
																	gap: 12,
																	marginTop: 8,
																}}
															>
																<div>
																	<div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>BEFORE</div>
																	<div style={{ fontSize: 13, padding: 8, background: '#fef2f2', borderRadius: 4 }}>
																		{fix.previousBulletContent}
																	</div>
																</div>
																<div>
																	<div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>AFTER</div>
																	<div style={{ fontSize: 13, padding: 8, background: '#f0fdf4', borderRadius: 4 }}>
																		{fix.finalBulletContent}
																	</div>
																</div>
															</div>
														)}
														{fix.bulletAction === 'new' && (
															<div
																style={{
																	fontSize: 13,
																	padding: 8,
																	background: '#f0fdf4',
																	borderRadius: 4,
																	marginTop: 4,
																}}
															>
																{fix.finalBulletContent}
															</div>
														)}
													</div>
												)
											})}
											</div>
										</td>
									</tr>
								)}
							</>
						)
					})}
				</tbody>
			</table>

			{totalPages > 1 && (
				<div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
					{page > 1 && (
						<Link
							to={buildPageUrl(page - 1)}
							style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: '#333' }}
						>
							← Prev
						</Link>
					)}
					<span style={{ padding: '6px 12px', color: '#666' }}>
						{page} / {totalPages}
					</span>
					{page < totalPages && (
						<Link
							to={buildPageUrl(page + 1)}
							style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, textDecoration: 'none', color: '#333' }}
						>
							Next →
						</Link>
					)}
				</div>
			)}

			{sessions.length === 0 && (
				<div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
					No match runs match your filters yet.
				</div>
			)}
		</div>
	)
}
