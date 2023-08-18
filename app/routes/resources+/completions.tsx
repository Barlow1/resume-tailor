import { type DataFunctionArgs } from '@remix-run/node'
import { eventStream } from 'remix-utils'
import { authenticator, requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import {
	getExperienceResponse,
	getGeneratedExperienceResponse,
} from '~/utils/openai.server.ts'

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
	const experience = url.searchParams.get('experience') ?? ''

	let response: any;
	if (experience) {
		;({ response } = await getExperienceResponse({
			experience,
			jobDescription,
			jobTitle,
			user,
		}))
	} else {
		;({ response } = await getGeneratedExperienceResponse({
			jobDescription,
			jobTitle,
			user,
		}))
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
					// newlines get stripped out of the stream, so we replace them with a placeholder
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
