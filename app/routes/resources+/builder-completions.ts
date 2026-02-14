import { json, type DataFunctionArgs } from '@remix-run/node'
import type OpenAI from 'openai'
import { authenticator, requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import {
	getBuilderExperienceResponse,
	getBuilderGeneratedExperienceResponse,
	getEntireTailoredResumeResponse,
} from '~/utils/openai.server.ts'
import { z } from 'zod';
import { parse } from '@conform-to/zod'
import { type ResumeData } from '~/utils/builder-resume.server.ts'
import { parseKeywordsFlat } from '~/utils/keyword-utils.ts'
import {
	trackAiTailorStarted,
	trackAiTailorCompleted,
	trackAiGenerateStarted,
	trackAiGenerateCompleted,
	identifyUser,
	trackError,
} from '~/lib/analytics.server.ts'
import { trackUserActivity } from '~/lib/retention.server.ts'
import { tryActivateUser } from '~/lib/activation.server.ts'

const builderCompletionSchema = z.object({
	experience: z.string().optional(),
	jobTitle: z.string(),
	jobDescription: z.string(),
	currentJobTitle: z.string().optional(),
	currentJobCompany: z.string().optional(),
	entireResume: z.string().optional(),
	resumeData: z.string().optional(),
	extractedKeywords: z.string().optional(),
	diagnosticContext: z.string().optional(),
})

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request, { redirectTo: '/builder' })

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, username: true },
	})
	if (!user) {
		await authenticator.logout(request, { redirectTo: '/' })
		return new Response(null, { status: 401 })
	}

	const formData = await request.formData()
	const submission = parse(formData, {
		schema: builderCompletionSchema,
	})
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const { experience, jobTitle, jobDescription, currentJobTitle, currentJobCompany, entireResume, resumeData, extractedKeywords, diagnosticContext: diagnosticContextRaw } = submission.value
	const parsedDiagnostic = diagnosticContextRaw ? JSON.parse(diagnosticContextRaw) as { issueType: string; reason: string; missingKeywords?: string[] } : null

	const startTime = Date.now()

	let response: OpenAI.Chat.Completions.ChatCompletion & {
		_request_id?: string | null;
	}

	if (entireResume === 'true' && resumeData) {
		const parsedResumeData = JSON.parse(resumeData) as ResumeData

		// Track AI tailor started
		trackAiTailorStarted(
			userId,
			'entire_resume',
			!!parsedResumeData.jobId,
			true, // isFreeTier - we don't check subscription here
			request,
			parsedResumeData.id ?? undefined,
			parsedResumeData.jobId ?? undefined,
		)

		try {
			const parsedKeywords = extractedKeywords ? (parseKeywordsFlat(extractedKeywords) ?? undefined) : undefined
			;[{ response }] = await Promise.all([
				await getEntireTailoredResumeResponse({
					resume: parsedResumeData,
					jobDescription,
					jobTitle,
					user,
					extractedKeywords: parsedKeywords,
				}),
				await prisma.gettingStartedProgress.upsert({
					where: { ownerId: userId },
					update: {
						tailorCount: {
							increment: 1,
						},
					},
					create: {
						hasSavedJob: false,
						hasSavedResume: false,
						hasGeneratedResume: false,
						hasTailoredResume: true,
						tailorCount: 1,
						ownerId: userId,
					},
				}),
			])

			// Track AI tailor completed
			trackAiTailorCompleted(
				userId,
				'entire_resume',
				Date.now() - startTime,
				true,
				undefined, // tokensUsed
				request,
				parsedResumeData.id ?? undefined,
				parsedResumeData.jobId ?? undefined,
			)

			// Update lifetime_ai_operations user property for retention analysis
			const progress = await prisma.gettingStartedProgress.findUnique({
				where: { ownerId: userId },
				select: { tailorCount: true, generateCount: true },
			})
			const totalAiOps = (progress?.tailorCount ?? 0) + (progress?.generateCount ?? 0)
			identifyUser(userId, {
				lifetime_ai_operations: totalAiOps,
				last_active_at: new Date().toISOString(),
			})

			// Track return visit if applicable
			await trackUserActivity({ userId, trigger: 'ai_tailor', request })

			// Check for activation
			await tryActivateUser(userId, 'ai_tailor_completed', request)
		} catch (error: any) {
			// Track AI tailor failed
			trackAiTailorCompleted(
				userId,
				'entire_resume',
				Date.now() - startTime,
				false,
				undefined, // tokensUsed
				request,
				parsedResumeData.id ?? undefined,
				parsedResumeData.jobId ?? undefined,
			)

			trackError(
				error.message,
				'entire_resume_tailor',
				userId,
				error.stack,
				request,
			)

			// Return user-friendly error with recovery options
			if (error.message?.includes('rate_limit') || error.code === 'rate_limit_exceeded') {
				return json(
					{
						error: 'Our AI is currently busy. Please try again in 30 seconds.',
						retryable: true,
						errorType: 'rate_limit',
					},
					{ status: 429 },
				)
			}

			if (error.message?.includes('context_length') || error.message?.includes('too long')) {
				return json(
					{
						error: 'Your resume is too long for full tailoring. Try tailoring individual bullet points instead.',
						suggestion: 'use_bullet_tailoring',
						retryable: false,
						errorType: 'context_length',
					},
					{ status: 400 },
				)
			}

			if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
				return json(
					{
						error: 'Request timed out. Your resume has been saved. Please try again.',
						retryable: true,
						errorType: 'timeout',
					},
					{ status: 504 },
				)
			}

			// Generic error with retry
			return json(
				{
					error: 'Something went wrong. Your resume is saved - click to retry.',
					retryable: true,
					errorType: 'unknown',
				},
				{ status: 500 },
			)
		}
	} else if (experience) {
		// Track AI tailor started
		trackAiTailorStarted(
			userId,
			'single_bullet',
			!!jobDescription,
			true, // isFreeTier
			request,
		)

		try {
			const parsedKeywords = extractedKeywords ? (parseKeywordsFlat(extractedKeywords) ?? undefined) : undefined
			const parsedResumeForBullet = resumeData ? (JSON.parse(resumeData) as ResumeData) : undefined
			;[{ response }] = await Promise.all([
				await getBuilderExperienceResponse({
					experience,
					jobDescription,
					jobTitle,
					currentJobTitle: currentJobTitle ?? '',
					currentJobCompany: currentJobCompany ?? '',
					resumeData: parsedResumeForBullet,
					user,
					extractedKeywords: parsedKeywords,
				}),
				await prisma.gettingStartedProgress.upsert({
					where: { ownerId: userId },
					update: {
						tailorCount: {
							increment: 1,
						},
					},
					create: {
						hasSavedJob: false,
						hasSavedResume: false,
						hasGeneratedResume: false,
						hasTailoredResume: true,
						tailorCount: 1,
						ownerId: userId,
					},
				}),
			])

			// Track AI tailor completed
			// Log for QA review
			const aiOutput = response.choices[0]?.message?.content ?? '{}'
			const tailorLog = await prisma.bulletTailorLog.create({
				data: {
					userId,
					originalBullet: experience,
					jobTitle,
					jobDescription,
					currentJobTitle: currentJobTitle ?? null,
					currentJobCompany: currentJobCompany ?? null,
					extractedKeywords: extractedKeywords ?? null,
					aiOutput,
					promptVersion: 'v2',
				},
			})

			// Attach logId to response for frontend action tracking
			;(response as any).tailorLogId = tailorLog.id

			// Track AI tailor completed in PostHog
			trackAiTailorCompleted(
				userId,
				'single_bullet',
				Date.now() - startTime,
				true,
				undefined, // tokensUsed
				request,
			)

			// Update lifetime_ai_operations user property for retention analysis
			const progress = await prisma.gettingStartedProgress.findUnique({
				where: { ownerId: userId },
				select: { tailorCount: true, generateCount: true },
			})
			const totalAiOps = (progress?.tailorCount ?? 0) + (progress?.generateCount ?? 0)
			identifyUser(userId, {
				lifetime_ai_operations: totalAiOps,
				last_active_at: new Date().toISOString(),
			})

			// Track return visit if applicable
			await trackUserActivity({ userId, trigger: 'ai_tailor', request })

			// Check for activation
			await tryActivateUser(userId, 'ai_tailor_completed', request)
		} catch (error: any) {
			// Track AI tailor failed
			trackAiTailorCompleted(
				userId,
				'single_bullet',
				Date.now() - startTime,
				false,
				undefined, // tokensUsed
				request,
			)

			trackError(
				error.message,
				'bullet_tailor',
				userId,
				error.stack,
				request,
			)

			// Return user-friendly error
			if (error.message?.includes('rate_limit') || error.code === 'rate_limit_exceeded') {
				return json(
					{
						error: 'Our AI is currently busy. Please try again in 30 seconds.',
						retryable: true,
						errorType: 'rate_limit',
					},
					{ status: 429 },
				)
			}

			return json(
				{
					error: 'Failed to tailor bullet point. Please try again.',
					retryable: true,
					errorType: 'unknown',
				},
				{ status: 500 },
			)
		}
	} else {
		// Track AI generate started
		trackAiGenerateStarted(
			userId,
			'generation',
			'bullet',
			request,
		)

		try {
			const parsedKeywords = extractedKeywords ? (parseKeywordsFlat(extractedKeywords) ?? undefined) : undefined
			const targetKeyword = parsedDiagnostic?.missingKeywords?.[0]
			const parsedResumeForGenerate = resumeData ? (JSON.parse(resumeData) as ResumeData) : undefined
			;[{ response }] = await Promise.all([
				await getBuilderGeneratedExperienceResponse({
					jobDescription,
					currentJobTitle: currentJobTitle ?? '',
					currentJobCompany: currentJobCompany ?? '',
					jobTitle,
					user,
					extractedKeywords: parsedKeywords,
					targetKeyword,
					resumeData: parsedResumeForGenerate,
				}),
				await prisma.gettingStartedProgress.upsert({
					where: { ownerId: userId },
					update: {
						generateCount: {
							increment: 1,
						},
					},
					create: {
						hasSavedJob: false,
						hasSavedResume: false,
						hasGeneratedResume: true,
						hasTailoredResume: false,
						generateCount: 1,
						ownerId: userId,
					},
				}),
			])

			// Track successful generation
			trackAiGenerateCompleted(
				userId,
				'generation',
				1, // bulletsGenerated
				Date.now() - startTime,
				true,
				request,
			)
		} catch (error: any) {
			// Track generation failed
			trackAiGenerateCompleted(
				userId,
				'generation',
				0,
				Date.now() - startTime,
				false,
				request,
			)

			trackError(
				error.message,
				'bullet_generation',
				userId,
				error.stack,
				request,
			)

			// Return user-friendly error
			if (error.message?.includes('rate_limit') || error.code === 'rate_limit_exceeded') {
				return json(
					{
						error: 'Our AI is currently busy. Please try again in 30 seconds.',
						retryable: true,
						errorType: 'rate_limit',
					},
					{ status: 429 },
				)
			}

			return json(
				{
					error: 'Failed to generate bullet points. Please try again.',
					retryable: true,
					errorType: 'unknown',
				},
				{ status: 500 },
			)
		}
	}

	return response;
}
