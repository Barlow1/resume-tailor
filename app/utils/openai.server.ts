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
	optionalInformation,
	user,
}: {
	experience: string
	jobTitle: string
	jobDescription: string
	currentJobTitle: string
	currentJobCompany: string
	optionalInformation: { question: string; answer: string }[]
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
					content: `Here is a list of questions I have answered separated by /n:
			${optionalInformation.map((info) => `Question: ${info.question} Answer: ${info.answer} /n`)}`,
					name,
				},
				{
					role: 'user',
					content: `Here are the current experiences listed in my resume: ${experience}.
	
                    Using any relevant information in the questions and the experience list I gave you, create a list of resume experience items  with the experience and achievements someone with this job description would have for a ${currentJobTitle} role at company ${currentJobCompany}
                    Keep the list limited to 10 items. Only 5 should have outcomes.
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
			temperature: 0.2,
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
	optionalInformation,
	user,
}: {
	jobTitle: string
	jobDescription: string
	currentJobTitle: string
	currentJobCompany: string
	optionalInformation: { question: string; answer: string }[]
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
					content: `Here is a list of questions about my experience and achievements separated by /n:
			${optionalInformation.map((info) => `Question: ${info.question} Answer: ${info.answer} /n`)}`,
					name,
				},
				{
					role: 'user',
					content: `Using any relevant information in the questions, generate a JSON string array of resume bullet points that someone with the experience and achievements for this job description would have for a ${currentJobTitle} role at company ${currentJobCompany}.
                    Keep the array limited to 10 items. Only 5 should have outcomes.
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
