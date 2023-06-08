import { Job } from '@prisma/client'
import { Configuration, OpenAIApi } from 'openai'

export const getAnimalResponse = async (animal: string) => {
	const configuration = new Configuration({
		organization: process.env.OPENAI_ORG_ID,
		apiKey: process.env.OPENAI_API_KEY,
	})
	const openai = new OpenAIApi(configuration)
	const completion = await openai.createCompletion({
		model: 'text-davinci-003',
		prompt: generateAnimalPrompt(animal),
		temperature: 0.6,
	})
	return completion.data.choices[0].text ?? ''
}

const generateAnimalPrompt = (animal: string) => {
	const capitalizedAnimal =
		animal[0].toUpperCase() + animal.slice(1).toLowerCase()
	return `Suggest three names for an animal that is a superhero.
  
  Animal: Cat
  Names: Captain Sharpclaw, Agent Fluffball, The Incredible Feline
  Animal: Dog
  Names: Ruff the Protector, Wonder Canine, Sir Barks-a-Lot
  Animal: ${capitalizedAnimal}
  Names:`
}

export const getExperienceResponse = async ({
	experience,
	jobTitle,
	jobDescription,
}: {
	experience: string
	jobTitle: string
	jobDescription: string
}) => {
	const configuration = new Configuration({
		organization: process.env.OPENAI_ORG_ID,
		apiKey: process.env.OPENAI_API_KEY,
	})
	const openai = new OpenAIApi(configuration)
	const completion = await openai.createCompletion({
		model: 'text-davinci-003',
		prompt: generateExperiencePrompt({
			experience,
			jobTitle,
			jobDescription,
		}),
		temperature: 0.6,
		max_tokens: 3000,
	})
	return completion.data.choices[0].text ?? ''
}

const generateExperiencePrompt = ({
	experience,
	jobTitle,
	jobDescription,
}: {
	experience: string
	jobTitle: string
	jobDescription: string
}) => {
	return `Create an Experience List using the following Experience List to 
	include specific examples with quantified 
	outcomes that will increase the chances of getting 
	an interview for the supplied Job Title and Job Description.
	Add and remove experiences if needed but only include the same amount of items in the list.
	Experience List: ${experience}
	Job Title: ${jobTitle}
	Job Description: ${jobDescription}
	Edited Experience List: `
}
