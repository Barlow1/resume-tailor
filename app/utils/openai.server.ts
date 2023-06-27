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
    const llm = new OpenAI({ temperature: 0, modelName: 'gpt-4' })
    const needs = `You are an expert resume writer with over 20 years of experience working with job seekers trying to land ${jobTitle} roles.
    Highlight the 3 most important responsibilities in this job description: ${jobDescription}.`
    const needIdentification = new PromptTemplate({
        template: needs,
        inputVariables: ['jobDescription', 'jobTitle'],
    })
    const needsChain = new LLMChain({
        llm,
        prompt: needIdentification,
        outputKey: 'jobNeeds',
    })

    const resumeLLM = new OpenAI({ temperature: 0, modelName: 'gpt-4' })
    const resume = `Based on these 3 most important responsibilities from the job description, please tailor my experience into no more than 4 succinct bullet points for this ${jobTitle} role. Do not make information up. Keep each bullet point up to 2 lines long. Here is my experience: ${experience}.` // Change made here
    const resumePrompt = new PromptTemplate({
        template: resume,
        inputVariables: ['jobNeeds', 'experience', 'jobTitle'], 
    })
    const resumeChain = new LLMChain({
        llm: resumeLLM,
        prompt: resumePrompt,
        outputKey: 'tailoredExperience',
    })

    const impactLLM = new OpenAI({temperature: 0, modelName: 'gpt-4' })
    const impact = `Re-write these bullet points using the XYZ formula structure.
    Use compelling language and keep the bullet point within 50 words. Do not make information up. If no clear way to do this exists, simply tell me I should consider rewriting my bullet points in a way that would fit this structure more closely.”`
    const impactPrompt = new PromptTemplate({
        template: impact,
        inputVariables: ['tailoredExperience'], 
    })
    const impactChain = new LLMChain({
        llm: impactLLM,
        prompt: impactPrompt,
        outputKey: 'bulletPoints',
    })

    const overallChain = new SequentialChain({
        chains: [needsChain, resumeChain, impactChain],
        inputVariables: ['jobTitle', 'jobDescription', 'experience'],
        verbose: true,
        outputVariables: ['bulletPoints'],
    })
    const result = await overallChain.call({ jobDescription, jobTitle, experience })
    return result.bulletPoints
}
