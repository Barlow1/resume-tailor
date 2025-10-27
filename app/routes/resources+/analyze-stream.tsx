import { type DataFunctionArgs } from '@remix-run/node'
import { eventStream } from 'remix-utils/sse/server'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { getAiFeedbackStreaming } from '~/lib/careerfit.server.ts'

export async function loader({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)

	const url = new URL(request.url)
	const analysisId = url.searchParams.get('analysisId') ?? ''
	const jdText = url.searchParams.get('jdText') ?? ''
	const resumeTxt = url.searchParams.get('resumeTxt') ?? ''
	const title = url.searchParams.get('title') ?? ''
	const company = url.searchParams.get('company') ?? ''

	if (!analysisId || !jdText || !resumeTxt) {
		return new Response('Missing required parameters', { status: 400 })
	}

	// Verify user has access to this analysis
	const analysis = await prisma.analysis.findUnique({
		where: { id: analysisId },
		select: { id: true },
	})

	if (!analysis) {
		return new Response('Analysis not found', { status: 404 })
	}

	const controller = new AbortController()
	request.signal.addEventListener('abort', () => {
		controller.abort()
	})

	return eventStream(controller.signal, function setup(send: any) {
		processAnalysisStream(controller, send, {
			jdText,
			resumeTxt,
			title,
			company,
		})
		return function clear() {}
	})
}

const processAnalysisStream = async (
	controller: AbortController,
	send: any,
	params: {
		jdText: string
		resumeTxt: string
		title: string
		company: string
	},
) => {
	try {
		console.log('🚀 Starting analysis stream...')
		const stream = await getAiFeedbackStreaming(
			params.jdText,
			params.resumeTxt,
			params.title,
			params.company,
		)

		let chunkCount = 0
		let totalContent = ''

		for await (const chunk of stream) {
			if (controller.signal.aborted) {
				console.log('⛔ Stream aborted by controller')
				break
			}

			const content = chunk.choices[0]?.delta?.content
			if (content) {
				chunkCount++
				totalContent += content
				// Send the raw content chunk
				send({ data: content })

				// Log progress at milestones (every 100 chunks to reduce noise)
				if (chunkCount % 100 === 0) {
					console.log(`📊 Streamed ${chunkCount} chunks, ${totalContent.length} chars`)
				}
			}

			// Check if stream is done
			const finishReason = chunk.choices[0]?.finish_reason
			if (finishReason) {
				console.log(`✅ Stream finished with reason: ${finishReason}`)
				console.log(`📊 Total: ${chunkCount} chunks, ${totalContent.length} chars`)
				console.log(`📦 First 200 chars:`, totalContent.substring(0, 200))
				console.log(`📦 Last 200 chars:`, totalContent.substring(totalContent.length - 200))

				if (finishReason === 'stop') {
					console.log('📤 Sending [DONE] signal')
					send({ data: '[DONE]' })
					controller.abort()
				}
			}
		}

		console.log('🏁 Stream loop completed')
	} catch (error) {
		console.error('❌ Stream processing error:', error)
		send({ data: `[ERROR]${error instanceof Error ? error.message : 'Unknown error'}` })
		controller.abort()
	}
}
