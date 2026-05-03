import { type DataFunctionArgs } from '@remix-run/node'
import * as XLSX from 'xlsx'
import { prisma } from '~/utils/db.server.ts'
import { requireAdmin } from '~/utils/permissions.server.ts'

const LEVEL_RANK: Record<string, number> = { mismatch: 0, weak: 1, moderate: 2, strong: 3 }

function improvedStatus(
	before: { level: string; covered: number; total: number },
	after: { level: string; covered: number; total: number } | null,
): 'pending' | 'yes' | 'no' | null {
	if (!after) return null
	const beforeRank = LEVEL_RANK[before.level] ?? -1
	const afterRank = LEVEL_RANK[after.level] ?? -1
	if (afterRank > beforeRank) return 'yes'
	if (afterRank < beforeRank) return 'no'
	const beforePct = before.total > 0 ? before.covered / before.total : 0
	const afterPct = after.total > 0 ? after.covered / after.total : 0
	return afterPct > beforePct ? 'yes' : 'no'
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

const MOVE_TYPES = [
	'rewrite_bullets',
	'cover_letter',
	'address_gap',
	'referral',
	'dont_apply',
	'linkedin',
] as const

function formatScore(level: string, covered: number, total: number): string {
	if (!level || total <= 0) return ''
	return `${level} (${covered}/${total})`
}

function formatCoveredLift(before: number, after: number | null | undefined): string {
	if (after == null) return ''
	const delta = after - before
	if (delta > 0) return `+${delta}`
	return String(delta)
}

function formatLevelLift(before: string, after: string | null | undefined): string {
	if (!after) return ''
	if (before === after) return `${before} (no change)`
	return `${before}→${after}`
}

function groupMovesByType(
	moves: Array<{ type: string; headline: string; explanation?: string }>,
): Record<string, string> {
	const grouped: Record<string, string[]> = {}
	for (const m of moves) {
		if (!m.type) continue
		const line = m.explanation ? `${m.headline} — ${m.explanation}` : m.headline
		;(grouped[m.type] ??= []).push(line)
	}
	const out: Record<string, string> = {}
	for (const t of MOVE_TYPES) {
		out[t] = (grouped[t] ?? []).join('\n')
	}
	return out
}

export async function loader({ request }: DataFunctionArgs) {
	await requireAdmin(request)

	const url = new URL(request.url)
	const userEmail = url.searchParams.get('userEmail') ?? ''
	const improvedFilter = url.searchParams.get('improved') ?? 'all'
	const beforeLevelFilter = url.searchParams.get('beforeLevel') ?? 'all'
	const startDate = url.searchParams.get('startDate')
	const endDate = url.searchParams.get('endDate')

	const runWhere: Record<string, unknown> = {}
	if (userEmail) runWhere.user = { email: { contains: userEmail } }
	if (beforeLevelFilter !== 'all') runWhere.level = beforeLevelFilter
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

	const runs = await prisma.experienceMatchRun.findMany({
		where: runWhere,
		orderBy: { createdAt: 'desc' },
		include: {
			user: { select: { email: true, username: true } },
			resume: { select: { id: true, name: true, role: true } },
			job: { select: { id: true, title: true, company: true, content: true } },
			requirementFixes: { orderBy: { createdAt: 'asc' } },
		},
	})

	const sessions = await Promise.all(
		runs.map(async run => {
			if (run.triggeredBy === 'post_tailor') {
				return { run, afterRun: null, improved: null as null | 'yes' | 'no' }
			}

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
					level: true,
					requirementsCovered: true,
					requirementsTotal: true,
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

	const filteredSessions =
		improvedFilter === 'all'
			? sessions
			: improvedFilter === 'untailored'
				? sessions.filter(s => s.improved === null)
				: sessions.filter(s => s.improved === improvedFilter)

	const runRows: Record<string, string | number>[] = []
	const fixRows: Record<string, string | number>[] = []

	for (const { run, afterRun, improved } of filteredSessions) {
		const covered = safeJsonArray(run.coveredRequirements)
		const missing = safeJsonArray(run.missingRequirements)
		const bestMoves = safeJsonBestMoves(run.bestMoves)
		const resumeLabel = run.resume?.name || run.resume?.role || run.resumeId
		const movesByType = groupMovesByType(bestMoves)

		runRows.push({
			'Session Date': new Date(run.createdAt).toLocaleString(),
			'User Email': run.user.email,
			'Username': run.user.username,
			'Resume': resumeLabel,
			'Job Title': run.job.title,
			'Job Company': run.job.company ?? '',
			'Job Description': run.job.content ?? '',
			'Trigger': run.triggeredBy,
			'Cache Hit': run.cacheHit ? 'yes' : 'no',
			'Score': formatScore(run.level, run.requirementsCovered, run.requirementsTotal),
			'Next Score': afterRun
				? formatScore(afterRun.level, afterRun.requirementsCovered, afterRun.requirementsTotal)
				: '',
			'Level Lift': formatLevelLift(run.level, afterRun?.level),
			'Covered Lift': formatCoveredLift(run.requirementsCovered, afterRun?.requirementsCovered),
			'Improved': improved ?? 'untailored',
			'Fix Count': run.requirementFixes.length,
			'Before Level': run.level,
			'Before Covered': run.requirementsCovered,
			'Before Total': run.requirementsTotal,
			'After Level': afterRun?.level ?? '',
			'After Covered': afterRun?.requirementsCovered ?? '',
			'After Total': afterRun?.requirementsTotal ?? '',
			'Covered Requirements': covered.join(' | '),
			'Missing Requirements': missing.join(' | '),
			'Move: rewrite_bullets': movesByType.rewrite_bullets,
			'Move: cover_letter': movesByType.cover_letter,
			'Move: address_gap': movesByType.address_gap,
			'Move: referral': movesByType.referral,
			'Move: dont_apply': movesByType.dont_apply,
			'Move: linkedin': movesByType.linkedin,
			'Best Moves (all)': bestMoves
				.map(m => `[${m.type}] ${m.headline}${m.explanation ? ` — ${m.explanation}` : ''}`)
				.join('\n'),
			'Run ID': run.id,
		})

		for (const fix of run.requirementFixes) {
			fixRows.push({
				'Session Date': new Date(run.createdAt).toLocaleString(),
				'User Email': run.user.email,
				'Resume': resumeLabel,
				'Job Title': run.job.title,
				'Job Company': run.job.company ?? '',
				'Before Level': run.level,
				'After Level': afterRun?.level ?? '',
				'Improved': improved ?? 'untailored',
				'Action': fix.bulletAction,
				'Experience ID': fix.experienceId,
				'Requirement (Gap)': fix.requirement,
				'Previous Bullet': fix.previousBulletContent ?? '',
				'Final Bullet': fix.finalBulletContent,
				'Fix Created At': new Date(fix.createdAt).toLocaleString(),
				'Run ID': run.id,
				'Fix ID': fix.id,
			})
		}
	}

	const workbook = XLSX.utils.book_new()

	const runsSheet = XLSX.utils.json_to_sheet(runRows)
	runsSheet['!cols'] = [
		{ wch: 18 }, // Session Date
		{ wch: 25 }, // User Email
		{ wch: 15 }, // Username
		{ wch: 25 }, // Resume
		{ wch: 25 }, // Job Title
		{ wch: 20 }, // Job Company
		{ wch: 60 }, // Job Description
		{ wch: 14 }, // Trigger
		{ wch: 9 },  // Cache Hit
		{ wch: 18 }, // Score
		{ wch: 18 }, // Next Score
		{ wch: 18 }, // Level Lift
		{ wch: 11 }, // Covered Lift
		{ wch: 11 }, // Improved
		{ wch: 9 },  // Fix Count
		{ wch: 12 }, // Before Level
		{ wch: 12 }, // Before Covered
		{ wch: 12 }, // Before Total
		{ wch: 12 }, // After Level
		{ wch: 12 }, // After Covered
		{ wch: 12 }, // After Total
		{ wch: 60 }, // Covered Requirements
		{ wch: 60 }, // Missing Requirements
		{ wch: 60 }, // Move: rewrite_bullets
		{ wch: 60 }, // Move: cover_letter
		{ wch: 60 }, // Move: address_gap
		{ wch: 60 }, // Move: referral
		{ wch: 60 }, // Move: dont_apply
		{ wch: 60 }, // Move: linkedin
		{ wch: 60 }, // Best Moves (all)
		{ wch: 24 }, // Run ID
	]
	XLSX.utils.book_append_sheet(workbook, runsSheet, 'Runs')

	const fixesSheet = XLSX.utils.json_to_sheet(fixRows)
	fixesSheet['!cols'] = [
		{ wch: 18 }, // Session Date
		{ wch: 25 }, // User Email
		{ wch: 25 }, // Resume
		{ wch: 25 }, // Job Title
		{ wch: 20 }, // Job Company
		{ wch: 12 }, // Before Level
		{ wch: 12 }, // After Level
		{ wch: 11 }, // Improved
		{ wch: 10 }, // Action
		{ wch: 15 }, // Experience ID
		{ wch: 50 }, // Requirement
		{ wch: 60 }, // Previous Bullet
		{ wch: 60 }, // Final Bullet
		{ wch: 18 }, // Fix Created At
		{ wch: 24 }, // Run ID
		{ wch: 24 }, // Fix ID
	]
	XLSX.utils.book_append_sheet(workbook, fixesSheet, 'Fixes')

	const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

	const dateStr = new Date().toISOString().split('T')[0]
	let filename = `match-history-${dateStr}`
	if (startDate) filename += `-from-${startDate}`
	if (endDate) filename += `-to-${endDate}`
	filename += '.xlsx'

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`,
		},
	})
}
