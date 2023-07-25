import {
	type ChatCompletionRequestMessage,
	Configuration,
	OpenAIApi,
} from 'openai'
import invariant from 'tiny-invariant'
import { type User } from '@prisma/client'

const openai = new OpenAIApi(
	new Configuration({
		apiKey: process.env.OPENAI_API_KEY,
	}),
)

export const getExperienceResponse = async ({
	experience,
	jobTitle,
	jobDescription,
	user,
}: {
	experience: string
	jobTitle: string
	jobDescription: string
	user: Partial<User>
}) => {
	const name = user.name ?? user.username

	const messages: Array<ChatCompletionRequestMessage> | null =
		jobTitle && jobDescription
			? [
					{
						role: 'system',
						content: `You are an expert resume writer with 20 years experience landing people ${jobTitle} roles. I want you to provide me a list of pain points, key skills, and responsibilities an applicant must have to get a first interview with the hiring manager.
 
                    Job Description: ${jobDescription}
                    `,
					},
					{
						role: 'user',
						content: `Expert Resume Writer: This is a list of pain points, key skills, and responsibilities an applicant must have to get a first interview with the hiring manager for the above job description:`,
						name,
					},
					{
						role: 'user',
						content: `Here are the current experiences listed in my resume: ${experience}.
	
                    Modify the experience I gave you to the pain points, key skills, and responsibilities to emphasize and succinctly present the following key experiences
                    required for this position. 
                    Ensure to merge similar experiences, remove redundant wording, and keep each skill description concise.
                    The modified experiences section should highlight these key experiences in a clear and brief single sentence that aligns with the requirements for the position.
                    Keep the list limited to 10 items.
                    Modified Experience List:`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.createChatCompletion(
		{
			model: 'gpt-4',
			messages,
			temperature: 0,
			max_tokens: 1024,
			stream: true,
		},
		{ responseType: 'stream' },
	)

	return { response }
}
