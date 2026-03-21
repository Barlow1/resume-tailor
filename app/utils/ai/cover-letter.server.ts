import { OpenAI } from 'openai'
import type { ResumeData } from '../builder-resume.server.ts'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'test-key' })

export async function generateCoverLetter(
	resumeData: ResumeData,
	jobDescription: string,
	jobTitle: string,
	company: string,
): Promise<string> {
	const resumeSummary = [
		resumeData.about,
		...(resumeData.experiences ?? []).map(e =>
			`${e.role} at ${e.company}: ${e.descriptions?.map(d => d.content).join('; ')}`
		),
		`Skills: ${(resumeData.skills ?? []).map(s => s.name).join(', ')}`,
	].filter(Boolean).join('\n')

	const response = await openai.chat.completions.create({
		model: 'gpt-5.2',
		messages: [
			{
				role: 'system',
				content: `Write a professional cover letter. Reference specific experience from the resume that matches the job. Under 400 words. No cliches ("I am writing to express my interest..."). Match the seniority level of the role. Be direct and specific.`,
			},
			{
				role: 'user',
				content: `Resume:\n${resumeSummary}\n\nJob Title: ${jobTitle}\nCompany: ${company}\nJob Description:\n${jobDescription}`,
			},
		],
	})

	return response.choices[0]?.message?.content ?? ''
}
