import { type DataFunctionArgs } from '@remix-run/node'
import { eventStream } from 'remix-utils/sse/server'
import { authenticator, getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import {
	getBuilderExperienceResponse,
	getGeneratedExperienceResponse,
} from '~/utils/openai.server.ts'

export async function loader({ request }: DataFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) {
		return eventStream(request.signal, function setup(send) {
			send({ event: 'redirect', data: JSON.stringify({ url: '/login?redirectTo=/builder' }) })
			return function clear() {}
		})
	}

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
	const experience = url.searchParams.get('experience') ?? ''

	let response: any
	if (experience) {
		;[{ response }] = await Promise.all([
			await getBuilderExperienceResponse({
				experience,
				jobDescription,
				jobTitle,
				currentJobTitle,
				currentJobCompany,
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
			await getGeneratedExperienceResponse({
				jobDescription,
				currentJobTitle,
				currentJobCompany,
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

	const controller = new AbortController()
	request.signal.addEventListener('abort', () => {
		controller.abort()
	})

	return eventStream(controller.signal, function setup(send) {
		response.data.on('data', (data: any) => {
			const lines = data
				.toString()
				.split('\n')
				.filter((line: string) => line.trim() !== '')

			for (const line of lines) {
				const message = line.toString().replace(/^data: /, '')
				if (message === '[DONE]') {
					return // Stream finished
				}
				try {
					const parsed = JSON.parse(message) as any
					const delta = parsed.choices[0].delta?.content?.replace(
						/\n/g,
						'__NEWLINE__',
					)
					if (delta) send({ data: delta })
				} catch (error) {
					console.error('Could not JSON parse stream message', message, error)
				}
			}
		})

		response.data.on('error', (error: any) => {
			console.error('Stream error', error)
		})

		response.data.on('end', () => {
			controller.abort()
		})


		return function clear() {}
	})
}
