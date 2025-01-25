import { OpenAI } from 'openai'
import { type User } from '@prisma/client'
import { invariant } from './misc.ts'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { type ResumeData } from './builder-resume.server.ts'

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
})

const builderExperienceDescriptionSchema = z.object({
	id: z.string().nullable().optional(),
	content: z.string().nullable().optional(),
	order: z.number().nullable().optional(),
})

const builderExperienceSchema = z.object({
	id: z.string().nullable().optional(),
	role: z.string().nullable().optional(),
	descriptions: z.array(builderExperienceDescriptionSchema).optional(),
})

const builderSkillSchema = z.object({
	id: z.string().nullable().optional(),
	name: z.string().nullable().optional(),
})

const builderHobbySchema = z.object({
	id: z.string().nullable().optional(),
	name: z.string().nullable().optional(),
})

const resumeSchema = z.object({
	id: z.string().nullable().optional(),
	role: z.string().nullable().optional(),
	about: z.string().nullable().optional(),
	experiences: z.array(builderExperienceSchema).optional(),
	skills: z.array(builderSkillSchema).optional(),
	hobbies: z.array(builderHobbySchema).optional(),
})

export const experienceSchema = z.object({
	experiences: z.array(z.string()),
})
const openaiExperienceResponseFormat = zodResponseFormat(
	experienceSchema,
	'experience',
)
const openaiResumeResponseFormat = zodResponseFormat(resumeSchema, 'resume')

export const getEntireTailoredResumeResponse = async ({
	resume,
	jobTitle,
	jobDescription,
	user,
}: {
	resume: ResumeData
	jobTitle: string
	jobDescription: string
	user: Partial<User>
}) => {
	const name = user.name ? user.name.replace(/ /g, '_') : user.username

	const messages =
		jobTitle && jobDescription
			? [
					{
						role: 'system' as const,
						content: `You are an expert resume writer with 20 years experience landing people ${jobTitle} roles.`,
					},
					{
						role: 'user' as const,
						content: `Here is the current resume in JSON format: ${JSON.stringify(resume)}`,
						name,
					},
					{
						role: 'user' as const,
						content: `Here is the job description: ${jobDescription}`,
						name,
					},
					{
						role: 'user' as const,
						content: `Return my entire resume with the experience and achievements tailored for this job description. Make sure to include the keywords from the job description.
			 Make sure to include the keywords, hard skills, and soft skills from the job description. Do not change any ids. Keep the current roles, companies, and dates exactly as they are in the experiences.`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-4o',
		messages,
		temperature: 0.2,
		max_tokens: 2048,
		response_format: openaiResumeResponseFormat,
	})

	return { response }
}

export const getBuilderExperienceResponse = async ({
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

	const messages =
		jobTitle && jobDescription
			? [
					{
						role: 'system' as const,
						content: `You are an expert resume writer with 20 years experience landing people ${jobTitle} roles.
 
                    Job Description: ${jobDescription}
                    `,
					},
					{
						role: 'user' as const,
						content: `Here is the current experience listed in my resume: ${experience}.
	
                    Generate a JSON string array of resume experience options that are derived from the experience I gave you with the experience and achievements for this job description would have for a ${currentJobTitle} role at company ${currentJobCompany}
                    Keep the list limited to 10 items. At most 5 should have outcomes. Make sure to include the keywords, hard skills, and soft skills from the job description. Make sure all the options have any keywords or outcomes included in the experience I gave you.
                    Only supply the JSON string array in the response.
					JSON String Array:`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-4o',
		messages,
		temperature: 0.2,
		max_tokens: 1024,
		response_format: openaiExperienceResponseFormat,
	})

	return { response }
}

export const getBuilderGeneratedExperienceResponse = async ({
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

	const messages =
		jobTitle && jobDescription
			? [
					{
						role: 'system' as const,
						content: `You are an expert resume writer with 20 years experience landing people ${jobTitle} roles. 
 
                    Job Description: ${jobDescription}
                    `,
					},
					{
						role: 'user' as const,
						content: `Generate a JSON string array of resume bullet points that someone with the experience and achievements for this job description would have for a ${currentJobTitle} role at company ${currentJobCompany}.
                    Keep the array limited to 10 items. Only 5 should have outcomes.
                    Only supply the JSON string array in the response`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-4o',
		messages,
		temperature: 0.2,
		max_tokens: 1024,
		response_format: openaiExperienceResponseFormat,
	})

	return { response }
}

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

	const messages =
		jobTitle && jobDescription
			? [
					{
						role: 'system' as const,
						content: `You are an expert resume writer with 20 years experience landing people ${jobTitle} roles.
 
                    Job Description: ${jobDescription}
                    `,
					},
					{
						role: 'user' as const,
						content: `Here are the current experiences listed in my resume: ${experience}.
	
                    Create a list of resume experience items combined with the experience list I gave you with the with the experience and achievements for this job description would have for a ${currentJobTitle} role at company ${currentJobCompany}
                    Keep the list limited to 10 items. Only 5 should have outcomes.
                    Modified Experience List:`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		messages,
		temperature: 0.2,
		max_tokens: 1024,
		stream: true,
		response_format: openaiExperienceResponseFormat,
	})

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

	const messages =
		jobTitle && jobDescription
			? [
					{
						role: 'system' as const,
						content: `You are an expert resume writer with 20 years experience landing people ${jobTitle} roles. 
 
                    Job Description: ${jobDescription}
                    `,
					},
					{
						role: 'user' as const,
						content: `Generate a JSON string array of resume bullet points that someone with the experience and achievements for this job description would have for a ${currentJobTitle} role at company ${currentJobCompany}.
                    Keep the array limited to 10 items. Only 5 should have outcomes.
                    Only supply the JSON string array in the response`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		messages,
		temperature: 0.2,
		max_tokens: 1024,
		stream: true,
		response_format: openaiExperienceResponseFormat,
	})

	return { response }
}
