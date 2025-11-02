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
import {
	trackTailorClicked,
	trackTailorCompleted,
	trackError,
} from '~/utils/tracking.server.ts'

const builderCompletionSchema = z.object({
	experience: z.string().optional(),
	jobTitle: z.string(),
	jobDescription: z.string(),
	currentJobTitle: z.string().optional(),
	currentJobCompany: z.string().optional(),
	entireResume: z.string().optional(),
	resumeData: z.string().optional(),
	extractedKeywords: z.string().optional(),
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

	const { experience, jobTitle, jobDescription, currentJobTitle, currentJobCompany, entireResume, resumeData, extractedKeywords } = submission.value

	const startTime = Date.now()

	let response: OpenAI.Chat.Completions.ChatCompletion & {
		_request_id?: string | null;
	}

	if (entireResume === 'true' && resumeData) {
		const parsedResumeData = JSON.parse(resumeData) as ResumeData

		// Track tailor click
		await trackTailorClicked({
			jobId: parsedResumeData.jobId || 'unknown',
			resumeId: parsedResumeData.id || 'unknown',
			experienceCount: parsedResumeData.experiences?.length || 0,
			userId,
			type: 'entire_resume',
		})

		try {
			const parsedKeywords = extractedKeywords ? (JSON.parse(extractedKeywords) as string[]) : undefined
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

			// Track successful completion
			await trackTailorCompleted({
				success: true,
				duration: Date.now() - startTime,
				userId,
				resumeId: parsedResumeData.id || 'unknown',
				jobId: parsedResumeData.jobId || 'unknown',
				type: 'entire_resume',
			})
		} catch (error: any) {
			// Track failure
			await trackTailorCompleted({
				success: false,
				error: error.message,
				duration: Date.now() - startTime,
				userId,
				resumeId: parsedResumeData.id || 'unknown',
				jobId: parsedResumeData.jobId || 'unknown',
				type: 'entire_resume',
			})

			await trackError({
				error: error.message,
				context: 'entire_resume_tailor',
				userId,
				stack: error.stack,
			})

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
		// Track bullet tailor click
		await trackTailorClicked({
			jobId: 'unknown',
			resumeId: 'unknown',
			experienceCount: 1,
			userId,
			type: 'single_bullet',
		})

		try {
			const parsedKeywords = extractedKeywords ? (JSON.parse(extractedKeywords) as string[]) : undefined
			;[{ response }] = await Promise.all([
				await getBuilderExperienceResponse({
					experience,
					jobDescription,
					jobTitle,
					currentJobTitle: currentJobTitle ?? '',
					currentJobCompany: currentJobCompany ?? '',
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

			// Track successful bullet tailor
			await trackTailorCompleted({
				success: true,
				duration: Date.now() - startTime,
				userId,
				type: 'single_bullet',
			})
		} catch (error: any) {
			// Track failure
			await trackTailorCompleted({
				success: false,
				error: error.message,
				duration: Date.now() - startTime,
				userId,
				type: 'single_bullet',
			})

			await trackError({
				error: error.message,
				context: 'bullet_tailor',
				userId,
				stack: error.stack,
			})

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
		try {
			const parsedKeywords = extractedKeywords ? (JSON.parse(extractedKeywords) as string[]) : undefined
			;[{ response }] = await Promise.all([
				await getBuilderGeneratedExperienceResponse({
					jobDescription,
					currentJobTitle: currentJobTitle ?? '',
					currentJobCompany: currentJobCompany ?? '',
					jobTitle,
					user,
					extractedKeywords: parsedKeywords,
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
			await trackTailorCompleted({
				success: true,
				duration: Date.now() - startTime,
				userId,
				type: 'single_bullet',
			})
		} catch (error: any) {
			// Track failure
			await trackTailorCompleted({
				success: false,
				error: error.message,
				duration: Date.now() - startTime,
				userId,
				type: 'single_bullet',
			})

			await trackError({
				error: error.message,
				context: 'bullet_generation',
				userId,
				stack: error.stack,
			})

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
