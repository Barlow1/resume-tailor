import { OpenAI } from 'openai'
import { type User } from '@prisma/client'
import { invariant } from './misc.ts'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { type ResumeData } from './builder-resume.server.ts'
import { type  Metric } from './outreach-helpers.server.ts'
import type { JobFit } from './ai-helpers.server.ts'

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY ?? 'test-key',
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

export const jobDescriptionSchema = z.object({
	id: z.string().nullable().optional(),
	title: z.string(),
	level: z.string().optional().default(""),
	location: z.string().optional().default(""),
	summary: z.string(),
	hard_skills: z.array(z.string()),
	soft_skills: z.array(z.string()),
	keywords: z.array(z.string()),
	responsibilites: z.array(z.string()),
})

export const resumeAnalysisSchema = z.object({
	id: z.string().nullable().optional(),
	summary: z.string().nullable().optional(),
	skills: z.array(z.string()),
	strengths: z.array(z.string()),
	concerns: z.array(z.string()),
	suggestions: z.array(z.string()),
	score: z.number().int().min(0).max(100),
})

export const jobFitSchema = z.object({
	id: z.string().nullable().optional(),
	role: z.string(),
	match_score: z.number().int().min(0).max(100),
	summary: z.string(),
	highlights: z.array(z.object({
		label: z.string(),
		detail: z.string(),
		evidence: z.object({
			text: z.string(),
			experienceId: z.string().nullable(),
			descriptionId: z.string().nullable()
		})
	})),
	responsibilities_alignment: z.array(z.object({
		requirement: z.string(),
		status: z.enum(['strong_match', 'partial_match', 'gap']),
		evidence: z.array(z.object({
			text: z.string(),
			experienceId: z.string().nullable(),
			descriptionId: z.string().nullable()
		}))

	})),
	skills: z.object({
		matched: z.array(z.string()),
		missing: z.array(z.string())
	}),
	metrics: z.array(z.object({
		statement: z.string(),
		metric: z.string(),
		value: z.string(),
		evidence: z.object({
			text: z.string(),
			experienceId: z.string().nullable(),
			descriptionId: z.string().nullable()
		})
	})),
	recommendations: z.array(z.string())
})

export const recruiterOutreachSchema = z.object({
	role: z.string(),
	email: z.object({
		subjects: z.array(z.string()).length(3),
		body: z.string()
	}),
	linkedinDM: z.object({ body: z.string() }),
	connectionNote: z.object({ body: z.string() }),
	followUp: z.object({ body: z.string() })
})

// v1 schema — kept for getBuilderGeneratedExperienceResponse (generation prompt)
export const experienceSchema = z.object({
	experiences: z.array(z.string()),
})
const openaiGenerateResponseFormat = zodResponseFormat(
	experienceSchema,
	'experience',
)

// v2 schema — holistic single-bullet tailor
const tailorOptionSchema = z.object({
	angle: z.enum(['Impact', 'Alignment', 'Transferable']),
	bullet: z.string(),
})

export const bulletTailorSchema = z.object({
	options: z.array(tailorOptionSchema).length(3),
	keyword_coverage_note: z.string(),
	weak_bullet_flag: z.string().nullable(),
	coverage_gap_flag: z.string().nullable(),
})

const openaiBulletTailorResponseFormat = zodResponseFormat(
	bulletTailorSchema,
	'bullet_tailor',
)

// Alias so the generate prompt still works without changes
const openaiExperienceResponseFormat = openaiGenerateResponseFormat
const openaiResumeResponseFormat = zodResponseFormat(resumeSchema, 'resume')

const openaiJDResponseFormat = zodResponseFormat(
	jobDescriptionSchema,
	'job_description',
)

const openaiResumeAnalysisFormat = zodResponseFormat(
	resumeAnalysisSchema,
	'resume',
)

const openaiJobFitResponseFormat = zodResponseFormat(
	jobFitSchema,
	'job_fit'
)

export const openaiRecruiterMessageResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "recruiter_messages",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        role: { type: "string" },
        email: {
          type: "object",
          additionalProperties: false,
          properties: {
            subjects: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 3
            },
            body: { type: "string" }
          },
          required: ["subjects", "body"]
        },
        linkedinDM: {
          type: "object",
          additionalProperties: false,
          properties: { body: { type: "string" } },
          required: ["body"]
        },
        connectionNote: {
          type: "object",
          additionalProperties: false,
          properties: { body: { type: "string" } }, 
          required: ["body"]
        },
        followUp: {
          type: "object",
          additionalProperties: false,
          properties: { body: { type: "string" } },
          required: ["body"]
        }
      },
      required: ["role", "email", "linkedinDM", "connectionNote", "followUp"]
    },
    strict: true
  }
} as const

export const getEntireTailoredResumeResponse = async ({
	resume,
	jobTitle,
	jobDescription,
	user,
	extractedKeywords,
}: {
	resume: ResumeData
	jobTitle: string
	jobDescription: string
	user: Partial<User>
	extractedKeywords?: string[]
}) => {
	const name = user.name ? user.name.replace(/ /g, '_') : user.username

	const messages =
		jobTitle && jobDescription
			? [
					{
						role: 'system' as const,
						content: `You are a resume editor specializing in keyword optimization and clarity. Your job is to tailor resumes to job descriptions by improving phrasing and incorporating relevant keywords — without changing the substance of what the candidate actually did.

Job Description:
${jobDescription}

${extractedKeywords && extractedKeywords.length > 0 ? `Target Keywords (from JD):
${extractedKeywords.join(', ')}` : ''}`,
					},
					{
						role: 'user' as const,
						content: `Here is the resume in JSON format:
${JSON.stringify(resume)}

Tailor this resume for the ${jobTitle} role following these rules:

AUTHENTICITY (NON-NEGOTIABLE):
- You may ONLY rephrase, reorder, and incorporate keywords into existing content
- If the original bullet has no metric, the output has NO metric
- Do NOT add percentages, dollar amounts, user counts, or timeframes not in the original
- Do NOT invent achievements, outcomes, scope, or details not explicitly stated
- Do NOT upgrade vague claims to specific ones (e.g., "improved performance" cannot become "improved performance by 40%")
- When uncertain, preserve the original wording

WHAT YOU CAN DO:
- Replace weak verbs with stronger ones (helped → led, worked on → developed)
- Reorder words to front-load keywords
- Add keywords from the JD where they fit naturally and truthfully
- Clarify awkward phrasing while preserving meaning
- Mirror JD terminology (e.g., if JD says "cross-functional," use that phrase if the original implies collaboration)

BULLET POINTS (descriptions array):
- Maximum 180 characters per bullet
- Use strong action verbs: Led, Developed, Implemented, Designed, Managed, Built, Created, Delivered
- Incorporate target keywords where truthful
- Preserve the original claim — just make it clearer and more ATS-friendly

SUMMARY (about field):
- Maximum 400 characters
- Lead with the most relevant qualification for this role
- Incorporate 2-4 target keywords naturally
- Do NOT add metrics or achievements not present in the resume

SKILLS (skills array):
- Add technical skills from the target keywords ONLY IF explicitly mentioned in bullet points or current skills
- Do NOT add skills the candidate hasn't demonstrated
- Canonicalize names (JS → JavaScript, AWS → Amazon Web Services)
- Keep to 10-20 skills maximum

PRESERVE EXACTLY:
- All IDs (resume.id, experience.id, description.id, skill.id)
- Company names, job titles, dates
- Number of experiences and their order
- Structure of all arrays

Return the complete resume JSON.`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-5.1',
		messages,
		temperature: 0.5,
		max_completion_tokens: 8192,
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
	resumeData,
	user,
	extractedKeywords,
}: {
	experience: string
	jobTitle: string
	jobDescription: string
	currentJobTitle: string
	currentJobCompany: string
	resumeData?: ResumeData
	user: Partial<User>
	extractedKeywords?: string[]
}) => {
	const name = user.name ? user.name.replace(/ /g, '_') : user.username

	// Build a plain-text snapshot of the full resume for context
	const resumeContext = resumeData
		? buildResumeContext(resumeData)
		: `Current role: ${currentJobTitle} at ${currentJobCompany}\nBullet to tailor: "${experience}"`

	const messages =
		jobTitle && jobDescription
			? [
					{
						role: 'system' as const,
						content: `You are a resume tailoring expert. Your job is to reframe a specific bullet from the user's resume to highlight relevance to a target role — without inventing anything they didn't do.

You will receive:
- The user's FULL RESUME (all sections: experience, skills, education, etc.)
- The SPECIFIC BULLET to rewrite (identified by role + bullet text)
- The TARGET JOB TITLE and JOB DESCRIPTION
${extractedKeywords && extractedKeywords.length > 0 ? `\nExtracted JD Keywords:\n${extractedKeywords.join(', ')}` : ''}`,
					},
					{
						role: 'user' as const,
						content: `FULL RESUME:
${resumeContext}

SPECIFIC BULLET TO REWRITE:
From role "${currentJobTitle}" at "${currentJobCompany}":
"${experience}"

TARGET JOB: ${jobTitle}

JOB DESCRIPTION:
${jobDescription}

---

STEP 1 — BUILD A SKILL INVENTORY (do this silently, do not output)
Before rewriting anything, scan the user's full resume and catalog:
- Every skill, tool, technology, and methodology they've claimed anywhere
- Their seniority level and career trajectory
- Whether the current resume and target role are in the same field or a pivot

This inventory defines the boundary of what you can reference. If a skill appears ANYWHERE on their resume, it's fair to reference in the rewrite. If it appears NOWHERE on their resume, you cannot add it.

STEP 2 — SCAN THE FULL RESUME FOR KEYWORD COVERAGE (do this silently)
Check which JD keywords are already covered by OTHER bullets on the resume.
- Keywords already well-represented elsewhere: do NOT force them into this bullet.
- Keywords not yet covered anywhere: this bullet is a candidate IF the keyword truthfully applies to what the user did in this role.
- Goal: each bullet carries the keywords that naturally fit IT, and collectively the resume covers the JD well. No single bullet should be a keyword dumping ground.

STEP 3 — REWRITE THE BULLET
Apply these rules in priority order:

RULE 1 — TRUTH IS THE HARD CONSTRAINT
- The rewritten bullet must describe what the user actually did in THIS specific role. Do not attribute work from other roles to this one.
- You may use terminology from the JD or from other parts of the resume to DESCRIBE this role's work more precisely — but you cannot INVENT new work.
- If the original bullet has no metric, the output has NO metric. Do not invent numbers, percentages, or scale.
- When uncertain, preserve the original wording.

What's allowed vs not:
  ALLOWED: User's bullet says "built web apps." Their skills section lists React. JD asks for React. → "Built web applications using React" is fair — you're adding specificity the user has claimed elsewhere.
  NOT ALLOWED: User's bullet says "built web apps." React appears nowhere on their resume. JD asks for React. → You cannot add React.
  NOT ALLOWED: User's bullet says "managed daily operations." JD says "P&L ownership." → You cannot rewrite as "managed P&L" unless the resume explicitly mentions P&L somewhere.

RULE 2 — THREE DISTINCT ANGLES
Return exactly 3 options, each with a different strategic purpose:

Option 1 — IMPACT: Lead with the result, outcome, or scale. Best when the bullet has metrics or clear business value.
Option 2 — ALIGNMENT: Use JD-relevant language to describe the same work. Place keywords that aren't yet covered elsewhere on the resume. Best when the experience maps well to the target role.
Option 3 — TRANSFERABLE: Abstract to the underlying capability. Best for career pivots or when the specific work doesn't map directly but the skill does.

Each option must be noticeably different — not a word rearrangement.
Maximum 200 characters per bullet. Start with a strong action verb.

RULE 3 — CAREER PIVOT HANDLING
If the resume's overall profile and the target role are in different fields:
- Do NOT paste JD jargon onto unrelated experience.
- Focus on transferable skills: compliance, coordination, stakeholder management, documentation, high-pressure decision-making, process adherence, etc.
- Option 3 becomes your strongest output — invest the most effort there.
- Honesty matters more than keyword density. A credible bullet that a hiring manager believes is worth more than a keyword-stuffed one they don't.

RULE 4 — WEAK BULLET FLAG
If the original bullet lacks quantifiable outcomes AND describes routine duties without clear impact, set weak_bullet_flag to a suggestion like:
"This bullet would be stronger with a measurable result. What was the volume, frequency, improvement, or outcome? e.g., 'supporting X accounts' or 'reducing Y by Z%.'"
Otherwise set weak_bullet_flag to null.

RULE 5 — COVERAGE GAP FLAG
If the JD contains a critical requirement (top 3 responsibilities or listed under "required qualifications") that appears NOWHERE on the full resume, set coverage_gap_flag to flag ONE gap max, like:
"The JD emphasizes [skill/requirement] but your resume doesn't mention it yet. If you have this experience, consider adding it to your skills or to a relevant bullet."
Otherwise set coverage_gap_flag to null. Only flag genuine critical gaps, not nice-to-haves.

KEYWORD COVERAGE NOTE:
In keyword_coverage_note, briefly state which keywords this bullet now covers, which are already covered elsewhere on the resume, and any critical JD keywords not covered anywhere.

Return ONLY valid JSON matching the required schema.`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-5.1',
		messages,
		temperature: 0.5,
		max_completion_tokens: 4096,
		response_format: openaiBulletTailorResponseFormat,
	})

	return { response }
}

/**
 * Converts full ResumeData into a plain-text context string for the LLM.
 * Keeps it compact but includes all sections the model needs for skill inventory.
 */
function buildResumeContext(resume: ResumeData): string {
	const sections: string[] = []

	if (resume.name || resume.role) {
		sections.push(`Name: ${resume.name ?? 'N/A'}\nTarget Role: ${resume.role ?? 'N/A'}`)
	}

	if (resume.about) {
		sections.push(`Summary:\n${resume.about}`)
	}

	if (resume.experiences && resume.experiences.length > 0) {
		const expLines = resume.experiences.map(exp => {
			const header = `${exp.role ?? 'Role'} at ${exp.company ?? 'Company'}${exp.startDate ? ` (${exp.startDate}–${exp.endDate ?? 'Present'})` : ''}`
			const bullets = (exp.descriptions ?? [])
				.filter(d => d.content)
				.map(d => `  • ${d.content}`)
				.join('\n')
			return `${header}\n${bullets}`
		}).join('\n\n')
		sections.push(`Experience:\n${expLines}`)
	}

	if (resume.education && resume.education.length > 0) {
		const eduLines = resume.education.map(ed =>
			`${ed.degree ?? ''} — ${ed.school ?? ''}${ed.startDate ? ` (${ed.startDate}–${ed.endDate ?? ''})` : ''}`
		).join('\n')
		sections.push(`Education:\n${eduLines}`)
	}

	if (resume.skills && resume.skills.length > 0) {
		const skillNames = resume.skills.map(s => s.name).filter(Boolean).join(', ')
		sections.push(`Skills: ${skillNames}`)
	}

	if (resume.hobbies && resume.hobbies.length > 0) {
		const hobbyNames = resume.hobbies.map(h => h.name).filter(Boolean).join(', ')
		sections.push(`Interests: ${hobbyNames}`)
	}

	return sections.join('\n\n')
}

export const getBuilderGeneratedExperienceResponse = async ({
	jobTitle,
	jobDescription,
	currentJobTitle,
	currentJobCompany,
	user,
	extractedKeywords,
}: {
	jobTitle: string
	jobDescription: string
	currentJobTitle: string
	currentJobCompany: string
	user: Partial<User>
	extractedKeywords?: string[]
}) => {
	const name = user.name ? user.name.replace(/ /g, '_') : user.username

	// Auto-detect seniority from job title
	const titleLower = currentJobTitle.toLowerCase()
	const seniority =
		titleLower.includes('senior') || titleLower.includes('staff') || titleLower.includes('principal') || titleLower.includes('lead') ? 'senior' :
		titleLower.includes('junior') || titleLower.includes('associate') || titleLower.includes('entry') ? 'junior' :
		'mid'

	const messages =
		jobTitle && jobDescription
			? [
					{
						role: 'system' as const,
						content: `You are an elite resume writer specializing in ${jobTitle} roles with 20 years of experience crafting achievement-focused bullets that pass ATS systems and impress hiring managers.

Job Description Context:
${jobDescription}

${extractedKeywords && extractedKeywords.length > 0 ? `
CRITICAL KEYWORDS (must incorporate naturally):
${extractedKeywords.slice(0, 8).join(', ')}

These are the highest-priority ATS terms. Weave them throughout naturally.` : ''}

TARGET ROLE: ${currentJobTitle} at ${currentJobCompany}
SENIORITY LEVEL: ${seniority}`,
					},
					{
						role: 'user' as const,
						content: `Generate 10 realistic, impressive resume bullet points that a ${seniority}-level ${currentJobTitle} at ${currentJobCompany} would have on their resume when applying to the target ${jobTitle} role.

LENGTH (CRITICAL): 
- Each bullet point (description.content): Maximum 180 characters (about 15-30 words)
- Count characters before returning - reject any bullet over 200 chars
- One-two lines per bullet when rendered on a resume

STRUCTURE (CAR/STAR format):
- Context: Set scope (team size, budget, timeline, scale)
- Action: Strong verb + what they did (Led, Architected, Drove, Scaled, Optimized)
- Result: Quantified outcome (%, $, time, users, uptime, efficiency)

QUANTIFICATION RULES:
- 7 bullets MUST include metrics (%, $, time saved, users served, performance gains, cost reduction)
- 3 bullets can focus on technical depth, architecture, or strategic initiatives without explicit metrics
- Numbers should be realistic for a ${currentJobCompany}-sized company and ${seniority} level

SENIORITY CALIBRATION:
${seniority === 'junior' ? `
- Focus on execution, learning, contributions to team projects
- Metrics: 10-30% improvements, features shipped, bugs fixed, tests written
- Scope: Individual contributor, small team collaborations
- Example: "Implemented caching layer reducing API response time by 28%, improving UX for 50k daily users"
` : seniority === 'mid' ? `
- Balance execution with some ownership/leadership
- Metrics: 20-50% improvements, project leadership, cross-functional work
- Scope: Lead small projects, mentor 1-2 people, own features end-to-end
- Example: "Led migration of legacy PHP monolith to microservices architecture, reducing deploy time from 45min to 8min and improving uptime from 99.2% to 99.8%"
` : `
- Emphasize leadership, strategy, business impact, technical vision
- Metrics: 30-70% improvements, $XXX cost savings, XX% revenue growth, team/org impact
- Scope: Lead teams, architect systems, influence roadmap, cross-org initiatives
- Example: "Architected real-time data pipeline processing 10M+ events/day using Kafka and Spark, enabling $2.4M in new revenue through predictive analytics features while reducing infrastructure costs 35%"
`}

ATS OPTIMIZATION:
- Naturally incorporate ${extractedKeywords && extractedKeywords.length > 0 ? 'the CRITICAL KEYWORDS listed above' : 'keywords from the job description'}
- Front-load important keywords in first 7 words
- Mirror job description phrasing where authentic
- Use exact tool/technology names from JD (e.g., "React" not "frontend framework")

IMPACT PRINCIPLES:
- Show business value, not just technical work ("increased revenue" > "wrote code")
- Include scope indicators (users served, data volume, team size, budget, timeline)
- Demonstrate leadership appropriate to seniority (mentored, led, drove, influenced)
- Mix technical depth with business outcomes

REALISM CHECK:
- Achievements must be plausible for ${currentJobCompany} (don't claim "100M users" if it's a startup)
- Technologies should align with what ${currentJobCompany} likely uses
- Metrics should be realistic for ${seniority} level
- Bullets should reflect typical ${currentJobTitle} responsibilities

VARIETY:
- Mix technical achievements, leadership, process improvements, business impact
- Vary sentence structure and starting verbs
- Different bullets emphasize different CRITICAL KEYWORDS
- Balance quantitative bullets (metrics) with qualitative (architecture, strategy)

Return ONLY a JSON object: { "experiences": ["bullet 1", "bullet 2", ...] }

No markdown, no extra text, just the JSON.`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-5.1',
		messages,
		temperature: 0.5,
		max_completion_tokens: 4096,
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
						content: `You are a resume editor. Rephrase bullet points to better match a job description — without changing what the candidate did.

Job Description:
${jobDescription}`,
					},
					{
						role: 'user' as const,
						content: `Here are the candidate's current bullet points for their ${currentJobTitle} role at ${currentJobCompany}:

${experience}

Rewrite each bullet to better align with the ${jobTitle} job description.

RULES:
- Rephrase and reorder only — do NOT add new claims
- If a bullet has no metric, your version has NO metric
- Do NOT add percentages, dollar amounts, user counts, or timeframes not in the original
- Do NOT invent achievements, outcomes, or scope
- Incorporate relevant keywords from the JD where truthful
- Maximum 180 characters per bullet
- Use strong action verbs

Return only the rewritten bullets, one per line. Same number of bullets as input.`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-5.1',
		messages,
		temperature: 0.4,
		max_completion_tokens: 2048,
		stream: true,
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
                    Only supply the JSON string array in the response. Do not include any other text or formatting.`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-5.1',
		messages,
		temperature: 0.4,
		max_completion_tokens: 2048,
		stream: true,
	})

	return { response }
}

export const getParsedJobDescription = async ({
	jobTitle,
	jobDescription,
	user,
}: {
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
					content: `Extract the job description into a normalized JSON object matching the schema. Return JSON only.`,
				},
				{
					role: 'user' as const,
					content: `Here is the full job description text: ${jobDescription}. Fill ALL fields. If a field is not present, infer from context or leave empty string; lists may be empty arrays.`,
					name,
				},
			]
		: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-5-mini',
		messages,
		temperature: 1, //gpt-5 only supports default temp 1
		max_completion_tokens: 1024,
		response_format: openaiJDResponseFormat,
	})
	return { response }
}

export const getAnalyzedResume = async ({
	resume,
	user,
}: {
	resume: string | ResumeData
	user: Partial<User>
}) => {
	const name = user.name ? user.name.replace(/ /g, '_') : user.username
	
	const messages = 
		resume
			? [
				{
					role: 'system' as const,
					content: `You are a candid hiring manager and ATS-savvy resume analyst. Return only JSON that matches the provided schema. Do not include markdown fences, prose, or explanations.

					Schema fields and rules:

					id: string | null | omitted. Prefer null unless a stable candidate identifier is explicitly present in the input (e.g., an id field or unique email). Do not invent one.

					summary: a short overview (1–3 sentences) of the candidate's profile; may be null if insufficient data.

					skills: array of canonical, deduplicated skill names inferred from the resume (tools, frameworks, languages, platforms, domains, methodologies). If none are present, return [].
					• Normalize synonyms to common forms (e.g., JS → JavaScript, TS → TypeScript, GSuite → Google Workspace, GCP → Google Cloud Platform).
					• Use Title Case where appropriate (e.g., React, Node.js, PostgreSQL, AWS, Kubernetes, TensorFlow, Project Management).
					• No levels or parentheticals (avoid "Advanced Excel" → "Excel").

					strengths: 3–5 resume-specific positives (impact, scope, leadership, outcomes, recognitions).

					concerns: 3–5 resume-specific risks or gaps (e.g., missing metrics, job-hopping, unexplained gaps, vague bullets, ATS issues).

					suggestions: 3 concrete actions the candidate can do this week to improve the resume (be specific and actionable; e.g., quantify outcomes, tighten bullets, add missing sections).

					score: integer 0–100 based on overall resume quality, independent of any job description.

					Scoring rubric (guideline, not to be included in output):
					• 90–100: Exceptionally clear, quantified, senior-appropriate; ATS-friendly; minimal concerns.
					• 80–89: Strong; minor gaps or modest quantification.
					• 70–79: Good baseline; several fixable issues (formatting, metrics, clarity).
					• 50–69: Needs significant work; limited evidence of impact; structural problems.
					• 0–49: Sparse or unusable content.

					General policy:

					Infer cautiously from provided content only. Do not hallucinate employers, dates, or credentials.

					Trim whitespace; keep strings concise.

					If data is missing, use null (for summary) or [] (for arrays) rather than guessing.

					Output must strictly conform to the response format and schema.`,
				},
				{
					role: 'user' as const,
					content: `Here is the full resume description text: ${resume}. Fill ALL fields. If a field is not present, infer from context or leave empty string or null; lists may be empty arrays.`,
					name,
				},
			]
		: null

	invariant(messages, 'Must provide resume')

	const response = await openai.chat.completions.create({
		model: 'gpt-5-mini',
		messages,
		temperature: 1, //gpt-5 only supports default temp 1
		max_completion_tokens: 4096,
		response_format: openaiResumeAnalysisFormat,
	})
	return { response }
}

export const getJobFit = async ({
	jobTitle,
	jobDescription,
	resume,
	user,
}: {
	jobTitle: string
	jobDescription: string
	resume: string | ResumeData
	user: Partial<User>
}) => {
	const name = user.name ? user.name.replace(/ /g, '_') : user.username
	const resumePaylod = typeof resume === 'string' ? `RESUME_TEXT:\n${resume}` : `RESUME_JSON:\n${JSON.stringify(resume)}`
	
	const messages = 
		jobTitle && jobDescription && resume
			? [
				{
					role: 'system' as const,
					content: `You compare a candidate resume to a job description and return ONLY JSON conforming exactly to the provided schema. Do not include markdown fences, comments, or explanations.

							Behavior & general rules
							- Use only information present in the inputs. Do NOT invent employers, dates, titles, or credentials.
							- If resume bullets include identifiers, propagate them: set evidence.experienceId / evidence.descriptionId from the input; otherwise use null.
							- Evidence.text must be a short, verbatim snippet from the resume (≤160 chars; you may trim with ellipses if needed) that supports the claim.
							- Keep all strings concise; trim whitespace; deduplicate arrays; keep ordering meaningful (most important first).
							- Set role to the provided job title verbatim.
							- Output must validate against the schema. Do not add extra fields.

							Responsibilities extraction & alignment
							- Parse the job description for responsibilities/requirements (bullets, "Responsibilities", "What you'll do", "Requirements", "Qualifications").
							- Normalize each requirement to a clear, single-sentence requirement string.
							- If there are many, select the 10–15 most critical/representative items.
							- For each requirement, classify status using resume evidence:
							• strong_match: clear, recent, hands-on alignment; same or very close skill/domain with direct outcomes.
							• partial_match: adjacent/transferable experience or weaker seniority; some relevance but not full.
							• gap: no credible evidence in the resume.
							- For strong/partial, include ≥1 evidence snippet. For gap, use an empty evidence array.

							Skills mapping
							- Build a canonical skill inventory from the job description (tools, frameworks, languages, platforms, domains, methodologies).
							- Canonicalize synonyms (e.g., JS→JavaScript, TS→TypeScript, GSuite→Google Workspace, GCP→Google Cloud Platform).
							- Title Case where appropriate (React, Node.js, PostgreSQL, AWS, Kubernetes, TensorFlow, Project Management).
							- skills.matched: skills required by the JD that are evidenced in the resume.
							- skills.missing: required or clearly emphasized JD skills not evidenced in the resume.
							- Do not include levels or parentheticals (e.g., "Advanced Excel" → "Excel"). Deduplicate both lists.

							Highlights
							- Provide 4–6 concise, resume-specific positives (impact, scope, leadership, outcomes, awards).
							- Each highlight must include a short label, a one-sentence detail, and a single supporting evidence snippet (with IDs if available).

							Metrics
							- Extract up to 5 quantified, resume-sourced results (e.g., "Reduced latency 45%", "Owned $2M budget").
							- For each metric, set:
							• statement: a compact, human-readable claim.
							• metric: the primary measure (e.g., "latency", "revenue", "users", "cost", "uptime").
							• value: the numeric/quantified value as written (e.g., "45%", "$2M", "+120k").
							• evidence: a resume snippet (and IDs if available).
							- Do not fabricate numbers.

							Summary
							- 1–2 sentences summarizing the candidate's fit for the specific role (may mention seniority, core strengths, and overall alignment). Keep neutral and evidence-based.

							Recommendations
							- Provide 3–5 concrete, JD-targeted actions the candidate can do THIS WEEK to improve fit or the resume (e.g., quantify a specific project, surface a missing tool, reorder bullets to front-load JD-aligned work, add a section).

							Scoring
							- Compute an integer match_score 0–100 using:
							• Responsibilities coverage (40%): score strong=1.0, partial=0.5, gap=0.0; average across included requirements, then weight 40%.
							• Skills coverage (40%): |matched| / (|matched| + |missing|), then weight 40%. If both lists are empty, treat this component as 0.
							• Seniority/impact (20%): heuristic from resume signals (leadership, scope, quantified results). Map none=0.0, some=0.5, strong=1.0; weight 20%.
							- Sum components, multiply by 100, round to nearest integer, and clamp to [0,100].

							Field-by-field schema contract
							- id: string | null | omitted. Prefer null unless a stable identifier exists in the input (e.g., provided id or unique email). Do not invent one.
							- role: the provided job title string.
							- match_score: integer 0–100 per "Scoring".
							- summary: short 1–2 sentence fit overview (plain text).
							- highlights: array of { label, detail, evidence:{ text, experienceId|null, descriptionId|null } }.
							- responsibilities_alignment: array of {
								requirement: string;
								status: one of 'strong_match' | 'partial_match' | 'gap';
								evidence: array of { text, experienceId|null, descriptionId|null } (empty if gap)
							}.
							- skills: { matched: string[]; missing: string[] } (canonicalized, deduped).
							- metrics: array of {
								statement: string;
								metric: string;
								value: string;
								evidence:{ text, experienceId|null, descriptionId|null }
							}.
							- recommendations: array of 3–5 concise, actionable strings.

							Failure & sparsity handling
							- If a field cannot be populated without guessing:
							• summary: use a concise, neutral sentence based only on available data; if truly insufficient, return an empty string.
							• arrays: return [] rather than fabricating content.
							- Never copy the entire resume/job description into any field. Keep evidence snippets short and targeted.

							Return ONLY the JSON object matching the schema.
							`,
				},
				{
					role: 'user' as const,
					content: `Here is the full job description text: ${jobDescription} and job title: ${jobTitle}. This is the resume: ${resumePaylod}. Fill ALL fields. If a field is not present, infer from context or leave empty string; lists may be empty arrays.`,
					name,
				},
			]
		: null

	invariant(messages, 'Must provide jobTitle, jobDescription, and resume')

	const response = await openai.chat.completions.create({
		model: 'gpt-5-mini',
		messages,
		temperature: 1, //gpt-5 only supports default temp 1
		max_completion_tokens: 16384,
		response_format: openaiJobFitResponseFormat,
	})
	return { response }
}

export const getRecruiterMessage = async ({
	jobTitle,
	jobDescription,
	fit,
	wins,
	recruiterName,
	user,
}: {
	jobTitle: string
	jobDescription: string
	fit: JobFit['skills']['matched']
	wins: Metric[] | Array<{ statement: string; value?: string }>
	recruiterName: string
	user: Partial<User>
}) => {
	const name = user.name ? user.name.replace(/ /g, '_') : user.username
	const winsInline = (wins ?? []).slice(0,2).map((w:any) => 
	'statement' in w ? w.statement : String(w)
	)
	const fitInline = (fit ?? []).slice(0.3)
	
	const messages = 
		jobTitle && fit && wins
			? [
				{
					role: 'system' as const,
					content: `You are a top-tier recruiter/hiring manager outreach copywriter. Write concise, high-conversion outreach that sounds human, not salesy. Return ONLY JSON matching the schema (no markdown, no extra keys).
					Start with a friendly greeting using their name. Then a sentence on who the user is. Think about problems the recruiter/hiring manager is likely facing that the role will solve. Then with a role-relevant line (DO NOT reuse the opening sentence) that ties a quantified win to likely priorities/problems, and do not fabricate a hook. Make value concrete with numbers and avoid buzzwords (no "passionate," "innovative," "synergy"). Keep one idea per sentence, short lines, zero fluff. Mirror likely priorities from the role/JD—delivery, risk, speed, alignment. Do not invent facts; use only the inputs given. Tone is confident, kind, and succinct. Use language like 'I'd love to chat' and other appreciative and human language.
					Channel limits: Email is ≤110 words with three short paragraphs plus a one-line CTA. LinkedIn DM is ≤700 characters in one paragraph. Connection note is ≤300 characters with no links. Follow-up is ≤70 words, references the original value with a fresh micro-proof, and offers an easy opt-out.
					Deliverables: Email with three subject options (≤7 words each, benefit-first) and a 110–120 word body that includes one proof link only if provided. LinkedIn DM that starts strong and ties win → role priority → CTA. LinkedIn Connection Note that's personal but concise with a soft CTA. A polite follow-up if there's no reply in 4–5 days. Make the tone of all text warm like a ${jobTitle}.`,
				},
				{
					role: 'user' as const,
					content: `Context

					Role I'm after: ${jobTitle}. My 1–2 signature wins (numbers, %): ${winsInline.join("; ") || "(none provided)"}. Why I'm a fit (skills/domain): ${fitInline.join(", ") || "(none provided)"}. The recruiter's name is ${recruiterName}. JD context (do not quote; do not invent): ${jobDescription ? jobDescription : ""}.
					Output
					Produce exactly these four: A) Email {subjects[3], body} — three benefit-first subject options (≤7 words each) and a 110–120 word body that includes a single proof link only if one is provided; B) LinkedIn DM {body} — one paragraph that opens strong and ties win → role priority → CTA; C) LinkedIn Connection Note {body} — personal, concise, soft CTA, no links, ≤300 characters; D) Polite Follow-Up {body} — if no reply in 4–5 days, ≤70 words, reference original value plus a fresh micro-proof with an easy opt-out.`,
					name,
				},
			]
		: null

	invariant(messages, 'Must provide jobTitle')

	const response = await openai.chat.completions.create({
		model: 'gpt-5-mini',
		messages,
		temperature: 1, //gpt-5 only supports default temp 1
		max_completion_tokens: 8192,
		response_format: openaiRecruiterMessageResponseFormat,
	})
	return { response }
}