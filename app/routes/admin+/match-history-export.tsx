import { type DataFunctionArgs } from '@remix-run/node'
import * as XLSX from 'xlsx'
import { prisma } from '~/utils/db.server.ts'
import { requireAdmin } from '~/utils/permissions.server.ts'

const LEVEL_RANK: Record<string, number> = { mismatch: 0, weak: 1, moderate: 2, strong: 3 }

function improvedValue(
	before: { level: string; covered: number },
	after: { level: string; covered: number } | null,
): 'pending' | 'yes' | 'no' {
	if (!after) return 'pending'
	const beforeRank = LEVEL_RANK[before.level] ?? -1
	const afterRank = LEVEL_RANK[after.level] ?? -1
	if (afterRank > beforeRank) return 'yes'
	if (afterRank === beforeRank && after.covered > before.covered) return 'yes'
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

	const runWhere: Record<string, unknown> = {
		requirementFixes: { some: {} },
	}

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
			job: { select: { id: true, title: true, company: true } },
			requirementFixes: { orderBy: { createdAt: 'asc' } },
		},
	})

	// One row per fix, with after-run lookup per session
	const rows: Record<string, string | number>[] = []

	for (const run of runs) {
		const lastFixAt =
			run.requirementFixes[run.requirementFixes.length - 1]?.createdAt ?? run.createdAt
		const afterRun = await prisma.experienceMatchRun.findFirst({
			where: {
				resumeId: run.resumeId,
				jobId: run.jobId,
				createdAt: { gt: lastFixAt },
			},
			orderBy: { createdAt: 'asc' },
			select: {
				level: true,
				requirementsCovered: true,
				requirementsTotal: true,
			},
		})

		const improved = improvedValue(
			{ level: run.level, covered: run.requirementsCovered },
			afterRun ? { level: afterRun.level, covered: afterRun.requirementsCovered } : null,
		)

		if (improvedFilter !== 'all' && improved !== improvedFilter) continue

		for (const fix of run.requirementFixes) {
			rows.push({
				'Session Date': new Date(run.createdAt).toLocaleString(),
				'User Email': run.user.email,
				'Username': run.user.username,
				'Resume': run.resume?.name || run.resume?.role || run.resumeId,
				'Job Title': run.job.title,
				'Job Company': run.job.company ?? '',
				'Before Level': run.level,
				'Before Covered': run.requirementsCovered,
				'Before Total': run.requirementsTotal,
				'After Level': afterRun?.level ?? '',
				'After Covered': afterRun?.requirementsCovered ?? '',
				'After Total': afterRun?.requirementsTotal ?? '',
				'Improved': improved,
				'Requirement (Gap)': fix.requirement,
				'Action': fix.bulletAction,
				'Experience ID': fix.experienceId,
				'Previous Bullet': fix.previousBulletContent ?? '',
				'Final Bullet': fix.finalBulletContent,
				'Fix Created At': new Date(fix.createdAt).toLocaleString(),
			})
		}
	}

	const worksheet = XLSX.utils.json_to_sheet(rows)
	const workbook = XLSX.utils.book_new()
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Match History')

	worksheet['!cols'] = [
		{ wch: 18 }, // Session Date
		{ wch: 25 }, // User Email
		{ wch: 15 }, // Username
		{ wch: 25 }, // Resume
		{ wch: 25 }, // Job Title
		{ wch: 20 }, // Job Company
		{ wch: 12 }, // Before Level
		{ wch: 12 }, // Before Covered
		{ wch: 12 }, // Before Total
		{ wch: 12 }, // After Level
		{ wch: 12 }, // After Covered
		{ wch: 12 }, // After Total
		{ wch: 10 }, // Improved
		{ wch: 50 }, // Requirement
		{ wch: 10 }, // Action
		{ wch: 15 }, // Experience ID
		{ wch: 60 }, // Previous Bullet
		{ wch: 60 }, // Final Bullet
		{ wch: 18 }, // Fix Created At
	]

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
