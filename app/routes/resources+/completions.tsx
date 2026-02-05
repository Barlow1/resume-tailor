import { type DataFunctionArgs } from '@remix-run/node'
import { eventStream } from 'remix-utils/sse/server'
import { authenticator, requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import {
	getExperienceResponse,
	getGeneratedExperienceResponse,
} from '~/utils/openai.server.ts'
import { trackAiGenerateStarted, trackAiGenerateCompleted } from '~/lib/analytics.server.ts'

export async function loader({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, username: true },
	})
	if (!user) {
		await authenticator.logout(request, { redirectTo: '/' })
		return new Response(null, { status: 401 })
	}

	const url = new URL(request.url)
	const jobTitle = url.searchParams.get('jobTitle') ?? ''
	const jobDescription = url.searchParams.get('jobDescription') ?? ''
	const currentJobTitle = url.searchParams.get('currentJobTitle') ?? ''
	const currentJobCompany = url.searchParams.get('currentJobCompany') ?? ''
	const experienceId = url.searchParams.get('experienceId') ?? 'unknown'
	const resumeId = url.searchParams.get('resumeId') ?? undefined
	const jobId = url.searchParams.get('jobId') ?? undefined

	const experience = url.searchParams.get('experience') ?? ''
	const startTime = Date.now()

	// Track AI generate started in PostHog
	trackAiGenerateStarted(
		userId,
		experienceId,
		'bullet',
		request,
		resumeId,
		jobId,
	)

	let response: any
	if (experience) {
		;({ response } = await getExperienceResponse({
			experience,
			jobDescription,
			jobTitle,
			currentJobTitle,
			currentJobCompany,
			user,
		}))
	} else {
		;({ response } = await getGeneratedExperienceResponse({
			jobDescription,
			currentJobTitle,
			currentJobCompany,
			jobTitle,
			user,
		}))
	}

	const controller = new AbortController()
	request.signal.addEventListener('abort', () => {
		controller.abort()
	})

	return eventStream(controller.signal, function setup(send: any) {
		processStream(controller, response, send, {
			userId,
			experienceId,
			startTime,
			request,
		})
		return function clear() {}
	})
}

const processStream = async (
	controller: any,
	response: any,
	send: any,
	params: {
		userId: string
		experienceId: string
		startTime: number
		request: Request
	},
) => {
	let bulletCount = 0
	let success = true

	for await (const data of response) {
		const lines = data
			.toString()
			.split('\n')
			.filter((line: string) => line.trim() !== '')

		for (const line of lines) {
			const message = line.toString().replace(/^data: /, '')
			if (message === '[DONE]') {
				// Track AI generate completed in PostHog
				const durationMs = Date.now() - params.startTime
				trackAiGenerateCompleted(
					params.userId,
					params.experienceId,
					bulletCount,
					durationMs,
					success,
					params.request,
				)
				controller.abort()
			}
			// if data is an empty object, skip it
			if (Object.keys(data.choices[0].delta).length === 0) {
				// Track AI generate completed in PostHog
				const durationMs = Date.now() - params.startTime
				trackAiGenerateCompleted(
					params.userId,
					params.experienceId,
					bulletCount,
					durationMs,
					success,
					params.request,
				)
				controller.abort()
			}
			try {
				// newlines get stripped out of the stream, so we replace them with a placeholder
				const delta = data.choices[0].delta?.content?.replace(
					/\n/g,
					'__NEWLINE__',
				)
				if (delta) {
					send({ data: delta })
					// Count bullet points (lines starting with - or •)
					if (delta.includes('__NEWLINE__-') || delta.includes('__NEWLINE__•')) {
						bulletCount++
					}
				}
			} catch (error) {
				console.error('Could not JSON parse stream message', message, error)
				success = false
			}
		}
	}
}
