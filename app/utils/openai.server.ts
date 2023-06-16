import { LLMChain, SequentialChain } from 'langchain/chains'
import { OpenAI } from 'langchain/llms/openai'
import { PromptTemplate } from 'langchain/prompts'

export const getExperienceResponse = async ({
	experience,
	jobTitle,
	jobDescription,
}: {
	experience: string
	jobTitle: string
	jobDescription: string
}) => {
	const llm = new OpenAI({ temperature: 0 })
	const template = `You are an expert resume writer with 20 years experience landing people {jobTitle} roles. I want you to provide me a list of pain points, key skills, and responsibilities an applicant must have to get a first interview with the hiring manager.
 
  Job Description: {jobDescription}

  Expert Resume Writer: This is a list of pain points, key skills, and responsibilities an applicant must have to get a first interview with the hiring manager for the above job description:`
	const promptTemplate = new PromptTemplate({
		template,
		inputVariables: ['jobDescription', 'jobTitle'],
	})
	const synopsisChain = new LLMChain({
		llm,
		prompt: promptTemplate,
		outputKey: 'previouslyGeneratedExperiences',
	})

	// This is an LLMChain to write a review of a play given a synopsis.
	const reviewLLM = new OpenAI({ temperature: 0 })
	const reviewTemplate = `Here are the current experiences listed in my resume: ${experience}.
	
	Modify this experience section to emphasize and succinctly present the following key experiences
	required for this position: {previouslyGeneratedExperiences}. 
	Ensure to merge similar experiences, remove redundant wording, and keep each skill description concise.
	The modified experiences section should highlight these key experiences in a clear and brief manner that aligns with the requirements for the position.
	Modified Experience List: `
	const reviewPromptTemplate = new PromptTemplate({
		template: reviewTemplate,
		inputVariables: ['previouslyGeneratedExperiences'],
	})
	const reviewChain = new LLMChain({
		llm: reviewLLM,
		prompt: reviewPromptTemplate,
		outputKey: 'tailoredExperience',
	})

	const overallChain = new SequentialChain({
		chains: [synopsisChain, reviewChain],
		inputVariables: ['jobTitle', 'jobDescription'],
		verbose: true,
		outputVariables: ['tailoredExperience'],
	})
	const review = await overallChain.call({ jobDescription, jobTitle })
	return review.tailoredExperience;
}
