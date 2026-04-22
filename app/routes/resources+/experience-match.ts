import { json, type ActionFunctionArgs } from '@remix-run/node'
import { createHash } from 'crypto'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { getExperienceMatch } from '~/utils/openai.server.ts'
import type { ResumeData } from '~/utils/builder-resume.server.ts'
import {
	trackExperienceMatchRequested,
	trackExperienceMatchLoaded,
	trackExperienceMatchFailed,
	trackPostTailorMatchLoaded,
	flushAnalytics,
} from '~/lib/analytics.server.ts'

function hashContent(data: unknown): string {
	return createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

function buildResumeHashInput(r: ResumeData) {
	return {
		about: r.about,
		experiences: (r.experiences ?? []).map(e => ({
			role: e.role,
			descriptions: e.descriptions?.map(d => d.content),
		})),
		skills: (r.skills ?? []).map(s => s.name),
		education: (r.education ?? []).map(e => ({ degree: e.degree, school: e.school })),
	}
}

type MatchLevel = 'strong' | 'moderate' | 'weak' | 'mismatch'

export async function action({ request }: ActionFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 })

	const body = await request.json()
	const { resumeId, jobId, isPostTailor, previousLevel, previousCovered, triggeredBy } = body as {
		resumeId: string
		jobId: string
		isPostTailor?: boolean
		previousLevel?: MatchLevel
		previousCovered?: number
		triggeredBy?: 'initial' | 'post_tailor' | 'manual_refresh'
	}

	const runTrigger: 'initial' | 'post_tailor' | 'manual_refresh' =
		triggeredBy ?? (isPostTailor ? 'post_tailor' : 'manual_refresh')

	const startTime = Date.now()
	trackExperienceMatchRequested(userId, resumeId, jobId, !!isPostTailor, request)

	try {
		const [resume, job] = await Promise.all([
			prisma.builderResume.findUnique({
				where: { id: resumeId, userId },
				include: {
					experiences: { include: { descriptions: true } },
					education: true,
					skills: true,
				},
			}),
			prisma.job.findUnique({ where: { id: jobId, ownerId: userId } }),
		])

		if (!resume || !job) {
			trackExperienceMatchFailed(userId, resumeId, jobId, 'not_found', Date.now() - startTime, request)
			await flushAnalytics()
			return json({ error: 'Not found' }, { status: 404 })
		}

		const resumeData: ResumeData = {
			about: resume.about,
			experiences: resume.experiences.map(e => ({
				id: e.id,
				role: e.role,
				company: e.company,
				startDate: e.startDate,
				endDate: e.endDate,
				descriptions: e.descriptions.map(d => ({ id: d.id, content: d.content })),
			})),
			education: resume.education.map(e => ({
				id: e.id,
				school: e.school,
				degree: e.degree,
				startDate: e.startDate,
				endDate: e.endDate,
				description: e.description,
			})),
			skills: resume.skills.map(s => ({ id: s.id, name: s.name })),
			visibleSections: null,
		}

		const resumeHash = hashContent(buildResumeHashInput(resumeData))
		const jobHash = hashContent(job.content)

		const cached = await prisma.experienceMatchCache.findUnique({
			where: { resumeId_jobId: { resumeId, jobId } },
		})

		let result: {
			level: MatchLevel
			requirementsTotal: number
			requirementsCovered: number
			missingRequirements: string[]
			bestMoves: unknown[]
			[key: string]: unknown
		}
		let fromCache = false

		if (cached && cached.resumeHash === resumeHash && cached.jobHash === jobHash) {
			result = JSON.parse(cached.resultJson) as typeof result
			fromCache = true
		} else {
			result = (await getExperienceMatch({ resumeData, jobDescription: job.content })) as typeof result
			await prisma.experienceMatchCache.upsert({
				where: { resumeId_jobId: { resumeId, jobId } },
				create: { resumeId, jobId, resumeHash, jobHash, resultJson: JSON.stringify(result) },
				update: { resumeHash, jobHash, resultJson: JSON.stringify(result) },
			})
		}

		try {
			await prisma.experienceMatchRun.create({
				data: {
					userId,
					resumeId,
					jobId,
					triggeredBy: runTrigger,
					level: result.level,
					requirementsCovered: result.requirementsCovered ?? 0,
					requirementsTotal: result.requirementsTotal ?? 0,
					missingRequirements: JSON.stringify(result.missingRequirements ?? []),
					coveredRequirements: JSON.stringify(result.coveredRequirements ?? []),
					bestMoves: JSON.stringify(result.bestMoves ?? []),
					cacheHit: fromCache,
				},
			})
		} catch (logErr) {
			console.error('[experience-match] failed to log run', logErr)
		}

		const duration = Date.now() - startTime
		const missingCount = result.missingRequirements?.length ?? 0
		const bestMovesCount = Array.isArray(result.bestMoves) ? result.bestMoves.length : 0

		trackExperienceMatchLoaded(
			userId,
			resumeId,
			jobId,
			result.level,
			result.requirementsTotal ?? 0,
			result.requirementsCovered ?? 0,
			missingCount,
			bestMovesCount,
			duration,
			fromCache,
			request,
		)

		if (isPostTailor) {
			const levelRank: Record<MatchLevel, number> = { mismatch: 0, weak: 1, moderate: 2, strong: 3 }
			const newRank = levelRank[result.level]
			const oldRank = previousLevel ? levelRank[previousLevel] : undefined
			const newCovered = result.requirementsCovered ?? 0
			const improved =
				(oldRank !== undefined && newRank > oldRank) ||
				(previousCovered !== undefined && newCovered > previousCovered)

			trackPostTailorMatchLoaded(
				userId,
				resumeId,
				jobId,
				result.level,
				newCovered,
				result.requirementsTotal ?? 0,
				improved,
				previousLevel,
				previousCovered,
				request,
			)
		}

		await flushAnalytics()
		return json(result)
	} catch (err) {
		const message = err instanceof Error ? err.message : 'unknown'
		trackExperienceMatchFailed(userId, resumeId, jobId, message.slice(0, 80), Date.now() - startTime, request)
		await flushAnalytics()
		throw err
	}
}
