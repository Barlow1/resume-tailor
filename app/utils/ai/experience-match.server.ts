import { z } from 'zod'
import { OpenAI } from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import type { ResumeData } from '../builder-resume.server.ts'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'test-key' })

const BestMoveSchema = z.object({
	id: z.string(),
	type: z.enum([
		'cover_letter', 'address_gap', 'referral',
		'rewrite_bullets', 'dont_apply', 'linkedin',
	]),
	headline: z.string(),
	explanation: z.string(),
	actionable: z.boolean(),
	evidenceNote: z.string().optional(),
})

const ExperienceMatchSchema = z.object({
	level: z.enum(['strong', 'moderate', 'weak', 'mismatch']),
	summary: z.string(),
	requirementsCovered: z.number(),
	requirementsTotal: z.number(),
	bestMoves: z.array(BestMoveSchema).max(4),
})

export type ExperienceMatch = z.infer<typeof ExperienceMatchSchema>
export type BestMove = z.infer<typeof BestMoveSchema>

const DEFAULT_COVER_LETTER_MOVE: BestMove = {
	id: 'default-cover-letter',
	type: 'cover_letter',
	headline: 'Write a cover letter',
	explanation: 'A tailored cover letter significantly increases your callback rate for this role.',
	actionable: true,
	evidenceNote: 'Tailored cover letters increase callbacks by 53% (ResumeGo, n=7,287)',
}

const DEFAULT_REFERRAL_MOVE: BestMove = {
	id: 'default-referral',
	type: 'referral',
	headline: 'A referral would 10x your odds',
	explanation: 'Cold applications have a ~2% response rate. A warm introduction from someone at the company dramatically improves your chances.',
	actionable: false,
	evidenceNote: 'Referred candidates are 4-5x more likely to be hired (LinkedIn Economic Graph)',
}

function postProcess(result: ExperienceMatch): ExperienceMatch {
	const moves = [...result.bestMoves]
	const needsCoverLetter =
		(result.level === 'strong' || result.level === 'moderate') &&
		!moves.some(m => m.type === 'cover_letter')
	const needsReferral = !moves.some(m => m.type === 'referral')

	if (needsCoverLetter) moves.unshift(DEFAULT_COVER_LETTER_MOVE)
	if (needsReferral) moves.push(DEFAULT_REFERRAL_MOVE)

	// Trim to 4: keep cover_letter first, referral last, trim middle
	if (moves.length > 4) {
		const first = moves[0]
		const last = moves[moves.length - 1]
		const middle = moves.slice(1, -1).slice(0, 2)
		return { ...result, bestMoves: [first, ...middle, last] }
	}

	return { ...result, bestMoves: moves }
}

export async function getExperienceMatch(
	resumeData: ResumeData,
	jobDescription: string,
): Promise<ExperienceMatch> {
	const resumeSummary = [
		resumeData.about,
		...(resumeData.experiences ?? []).map(e =>
			`${e.role} at ${e.company}: ${e.descriptions?.map(d => d.content).join('; ')}`
		),
		`Skills: ${(resumeData.skills ?? []).map(s => s.name).join(', ')}`,
		...(resumeData.education ?? []).map(e => `${e.degree} at ${e.school}`),
	].filter(Boolean).join('\n')

	const experienceMatchResponseFormat = zodResponseFormat(ExperienceMatchSchema, 'experience_match')

	const response = await openai.chat.completions.create({
		model: 'gpt-4o-mini',
		messages: [
			{
				role: 'system',
				content: `You assess how well a candidate's actual experience matches a job description. Compare real experience against requirements — not keyword overlap.

Rules:
- Be honest. "mismatch" and "dont_apply" are valid outputs.
- Detect employment gaps from resume dates and recommend addressing them if present.
- Always include a cover_letter best move if match level is moderate or strong.
- Always include a referral recommendation.
- Evidence notes must cite real research with numbers.
- Max 4 best moves.
- Summary should be 1-2 plain-language sentences. Example: "Your 4 years of product management covers 5 of 6 core requirements. The gap: they want experience with enterprise sales cycles."`,
			},
			{
				role: 'user',
				content: `Resume:\n${resumeSummary}\n\nJob Description:\n${jobDescription}`,
			},
		],
		response_format: experienceMatchResponseFormat,
	})

	const content = response.choices[0]?.message?.content
	if (!content) throw new Error('Failed to get experience match response')
	const result = ExperienceMatchSchema.parse(JSON.parse(content))

	return postProcess(result)
}
