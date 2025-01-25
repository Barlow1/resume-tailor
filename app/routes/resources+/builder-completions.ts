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

const builderCompletionSchema = z.object({
	experience: z.string().optional(),
	jobTitle: z.string(),
	jobDescription: z.string(),
	currentJobTitle: z.string().optional(),
	currentJobCompany: z.string().optional(),
	entireResume: z.string().optional(),
	resumeData: z.string().optional(),
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

	const { experience, jobTitle, jobDescription, currentJobTitle, currentJobCompany, entireResume, resumeData } = submission.value

	let response: OpenAI.Chat.Completions.ChatCompletion & {
		_request_id?: string | null;
	}

	if (entireResume === 'true' && resumeData) {
		;[{ response }] = await Promise.all([
			await getEntireTailoredResumeResponse({
				resume: JSON.parse(resumeData) as ResumeData,
				jobDescription,
				jobTitle,
				user,
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
	} else if (experience) {
		;[{ response }] = await Promise.all([
			await getBuilderExperienceResponse({
				experience,
				jobDescription,
				jobTitle,
				currentJobTitle: currentJobTitle ?? '',
				currentJobCompany: currentJobCompany ?? '',
				user,
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
	} else {
		;[{ response }] = await Promise.all([
			await getBuilderGeneratedExperienceResponse({
				jobDescription,
				currentJobTitle: currentJobTitle ?? '',
				currentJobCompany: currentJobCompany ?? '',
				jobTitle,
				user,
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
	}

	return response;
}
