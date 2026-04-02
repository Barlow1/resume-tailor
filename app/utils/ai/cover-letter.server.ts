import type { ResumeData } from '../builder-resume.server.ts'

export const COVER_LETTER_SYSTEM_PROMPT = `Write a professional cover letter. You have one job: make the hiring manager want to interview this person.

RULES:
- Open with something specific about the company, their product, or a recent initiative — not about yourself. Show you researched them.
- Reference SPECIFIC accomplishments from the resume that directly match job requirements. If the resume says "Design 80%" or other vague bullets, DO NOT reference them. Only cite concrete, specific work.
- If the resume lacks specific accomplishments, focus on: relevant skills applied in context, genuine interest in the company's specific work, and what you'd bring based on your background. Do not fabricate achievements.
- Under 400 words. Shorter is better if the content is strong.
- BANNED PHRASES: "I am writing to express my interest", "I am excited to apply", "I believe I would be a great fit", "please find my resume attached", "I look forward to the opportunity", "I am confident that", "Dear Hiring Manager" (use the company name or team name instead).
- Match seniority level. Senior roles: confident, strategic language, mention leadership and impact. Mid-level: specific contributions, growth trajectory. Entry-level: relevant coursework/projects, eagerness backed by specific knowledge.
- End with a specific ask or next step, not a generic "looking forward to hearing from you."
- Tone: professional but human. Not robotic, not overly casual. Write like a smart person talking.`

export function buildCoverLetterResumeSummary(resumeData: ResumeData): string {
	return [
		resumeData.about,
		...(resumeData.experiences ?? []).map(e =>
			`${e.role} at ${e.company}: ${e.descriptions?.map(d => d.content).join('; ')}`
		),
		`Skills: ${(resumeData.skills ?? []).map(s => s.name).join(', ')}`,
	].filter(Boolean).join('\n')
}
