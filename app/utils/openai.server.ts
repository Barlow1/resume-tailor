import {
	type ChatCompletionRequestMessage,
	Configuration,
	OpenAIApi,
} from 'openai'
import { type User } from '@prisma/client'
import { invariant } from './misc.ts'

const openai = new OpenAIApi(
	new Configuration({
		apiKey: process.env.OPENAI_API_KEY,
	}),
)

export const getExperienceResponse = async ({
	experience,
	jobTitle,
	jobDescription,
	currentJobTitle,
	currentJobCompany,
	user,
}: {
	experience: string
	jobTitle: string
	jobDescription: string
	currentJobTitle: string
	currentJobCompany: string
	user: Partial<User>
}) => {
	const name = user.name ? user.name.replace(/ /g, '_') : user.username

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
                    required for this position for someone in a ${currentJobTitle} role at company ${currentJobCompany}
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

export const getGeneratedExperienceResponse = async ({
	jobTitle,
	jobDescription,
	currentJobTitle,
	currentJobCompany,
	user,
}: {
	jobTitle: string
	jobDescription: string
	currentJobTitle: string
	currentJobCompany: string
	user: Partial<User>
}) => {
	const name = user.name ? user.name.replace(/ /g, '_') : user.username

	const messages: Array<ChatCompletionRequestMessage> | null =
		jobTitle && jobDescription
			? [
					{
						role: 'system',
						content: `You are an expert resume writer with 20 years experience landing people ${jobTitle} roles. 
 
                    Job Description: ${jobDescription}
                    `,
					},
					{
						role: 'user',
						content: `Generate a JSON string array of resume bullet points that someone with the experience and achievements for this job description would have for a ${currentJobTitle} role at company ${currentJobCompany}.
                    Keep the array limited to 10 items.
                    Only supply the JSON string array in the response`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.createChatCompletion(
		{
			model: 'gpt-4',
			messages,
			temperature: 0.2,
			max_tokens: 1024,
			stream: true,
		},
		{ responseType: 'stream' },
	)

	return { response }
}
