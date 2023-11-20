import { type DataFunctionArgs } from '@remix-run/node'
import { eventStream } from 'remix-utils/sse/server'
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
	const currentJobTitle = url.searchParams.get('currentJobTitle') ?? ''
	const currentJobCompany = url.searchParams.get('currentJobCompany') ?? ''
	const badOptionalInformation = [
		{
			question:
				'Describe specific projects you led or contributed to. What were the outcomes?',
			answer:
				'Implemented new agile methodologies that resulted in a 20% decrease in yearly spend',
		},
		{
			question:
				'Can you quantify your contributions in terms of revenue increase, cost reduction, or efficiency improvement?',
			answer: 'Onboarded international customers resulting in a 50% growth in user base.',
		},
		{
			question:
				'Did you implement any new processes or systems? What was the impact?',
			answer: 'Introduced new processes for improved efficiency.',
		},
		{
			question:
				'Were there any notable increases in customer satisfaction or market share during your tenure?',
			answer:
				'Achieved improvements in customer satisfaction and market share.',
		},
		{
			question:
				'Did you receive any awards or recognitions? What were they for?',
			answer: 'Received awards for outstanding contributions.',
		},
		{
			question: 'How many team members did you manage or mentor?',
			answer: 'Managed and mentored a team of professionals.',
		},
		{
			question:
				'What were the key targets or KPIs in your roles, and how did you perform against them?',
			answer: 'Met or exceeded key performance targets consistently.',
		},
		{
			question:
				'Did you manage or work with a budget? How large was it, and how did you optimize its use?',
			answer: 'Managed and optimized budget effectively.',
		},
		{
			question:
				'Describe any cost-saving initiatives you implemented or contributed to.',
			answer: 'Implemented cost-saving initiatives for efficiency.',
		},
		{
			question:
				'Were there any significant challenges or obstacles you overcame? What was the result?',
			answer: 'Overcame challenges, achieving positive results.',
		},
	]
	// const goodOptionalInformation = [
	// 	{
	// 		question:
	// 			'Describe specific projects you led or contributed to. What were the outcomes?',
	// 		answer:
	// 			'I led the development of a customer relationship management (CRM) system that streamlined communication and improved data accessibility. The outcome was a 20% increase in sales productivity and a 15% reduction in customer response time.',
	// 	},
	// 	{
	// 		question:
	// 			'Can you quantify your contributions in terms of revenue increase, cost reduction, or efficiency improvement?',
	// 		answer:
	// 			'I implemented code optimizations that resulted in a 30% reduction in server costs, contributing to an annual cost savings of $500,000. Additionally, I introduced a caching mechanism that improved application response times, leading to a 15% increase in user engagement.',
	// 	},
	// 	{
	// 		question:
	// 			'Did you implement any new processes or systems? What was the impact?',
	// 		answer:
	// 			'I introduced an Agile development process that increased project delivery speed by 25%. This resulted in a more adaptive and responsive development environment, leading to a 10% improvement in software quality and a 20% decrease in post-release defects.',
	// 	},
	// 	{
	// 		question:
	// 			'Were there any notable increases in customer satisfaction or market share during your tenure?',
	// 		answer:
	// 			'Yes, I spearheaded a customer feedback initiative that resulted in a 15% improvement in customer satisfaction scores. This, in turn, contributed to a 10% increase in market share within the first year of implementation.',
	// 	},
	// 	{
	// 		question:
	// 			'Did you receive any awards or recognitions? What were they for?',
	// 		answer:
	// 			"I received the 'Innovation Excellence Award' for the successful implementation of a machine learning algorithm that improved product recommendation accuracy by 30%, leading to a significant boost in customer engagement.",
	// 	},
	// 	{
	// 		question: 'How many team members did you manage or mentor?',
	// 		answer:
	// 			'I managed a team of 10 software engineers, providing mentorship and guidance. I established a mentorship program that resulted in a 20% increase in employee satisfaction and a 15% decrease in turnover within the team.',
	// 	},
	// 	{
	// 		question:
	// 			'What were the key targets or KPIs in your roles, and how did you perform against them?',
	// 		answer:
	// 			'Key targets included a 20% improvement in project delivery timelines and a 15% reduction in software defects. I consistently met or exceeded these targets, achieving a 25% improvement in project delivery timelines and a 20% reduction in software defects.',
	// 	},
	// 	{
	// 		question:
	// 			'Did you manage or work with a budget? How large was it, and how did you optimize its use?',
	// 		answer:
	// 			'I managed a project budget of $1 million, and I optimized its use by implementing a cost-tracking system that identified areas for cost reduction. This resulted in a 10% under-budget delivery while maintaining project quality.',
	// 	},
	// 	{
	// 		question:
	// 			'Describe any cost-saving initiatives you implemented or contributed to.',
	// 		answer:
	// 			'I implemented a cloud resource optimization strategy that resulted in a 15% reduction in infrastructure costs. Additionally, I introduced automated testing procedures, reducing testing time by 30% and lowering overall project costs by 12%.',
	// 	},
	// 	{
	// 		question:
	// 			'Were there any significant challenges or obstacles you overcame? What was the result?',
	// 		answer:
	// 			'One significant challenge was a critical security vulnerability in our software. I led a cross-functional team to quickly address the issue, resulting in a 40% improvement in system security and ensuring the trust of our customers was maintained.',
	// 	},
	// ]

	const optionalInformation = badOptionalInformation

	const experience = url.searchParams.get('experience') ?? ''

	let response: any
	if (experience) {
		;({ response } = await getExperienceResponse({
			experience,
			jobDescription,
			jobTitle,
			currentJobTitle,
			currentJobCompany,
			optionalInformation,
			user,
		}))
	} else {
		;({ response } = await getGeneratedExperienceResponse({
			jobDescription,
			currentJobTitle,
			currentJobCompany,
			jobTitle,
			optionalInformation,
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
