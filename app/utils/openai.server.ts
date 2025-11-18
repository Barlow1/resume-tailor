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
	timeout: 120000, // 120 second timeout (2 minutes)
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

export const experienceSchema = z.object({
	experiences: z.array(z.string()),
})
const openaiExperienceResponseFormat = zodResponseFormat(
	experienceSchema,
	'experience',
)
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
						content: `You are an elite resume writer specializing in ${jobTitle} roles with 20 years of experience getting candidates past ATS systems and impressing hiring managers at top companies.

Your expertise: Tailoring complete resumes to job descriptions by rewriting bullet points with quantified achievements, optimizing summaries for ATS, and strategically incorporating keywords.

Job Description Context:
${jobDescription}

${extractedKeywords && extractedKeywords.length > 0 ? `
CRITICAL KEYWORDS (highest-priority ATS terms):
${extractedKeywords.join(', ')}

These must be woven throughout the resume naturally - especially in bullet points and summary.` : ''}`,
					},
					{
						role: 'user' as const,
						content: `Here is the current resume in JSON format: ${JSON.stringify(resume)}`,
						name,
					},
					{
						role: 'user' as const,
						content: `Tailor this entire resume for the ${jobTitle} role by following these rules:

LENGTH REQUIREMENTS (CRITICAL):
- Each bullet point (description.content): Maximum 180 characters (about 15-30 words)
- Summary (about): Maximum 400 characters
- Count characters before returning - reject any bullet over 200 chars
- One-two lines per bullet when rendered on a resume

1. BULLET POINTS (descriptions array):
   
   STRUCTURE (CAR/STAR):
   - Context: What was the situation/scope?
   - Action: Strong verb (Led, Architected, Optimized, Scaled, Drove, Reduced, Increased)
   - Result: Quantified outcome (%, $, time saved, users impacted, uptime)
   
   ATS OPTIMIZATION:
   - Naturally incorporate ${extractedKeywords && extractedKeywords.length > 0 ? 'the CRITICAL KEYWORDS listed above' : 'relevant keywords from the job description'}
   - Front-load important keywords in first 5-7 words
   - Mirror job description phrasing where authentic
   - Use exact tool/technology names from JD
   
   IMPACT REQUIREMENTS:
   - 60-70% of bullets MUST include quantified outcomes (numbers, %, $, timelines, scope)
   - Remaining bullets can focus on technical depth, architecture, or process improvements
   - Show business value, not just technical work
   - Include scope indicators (users served, data volume, team size, timeline)
   
   AUTHENTICITY:
   - Keep core truth of each original bullet - don't fabricate different achievements
   - Expand on implied impact with realistic estimates where appropriate
   - Stay within plausible bounds for each role and company
   
   VARIETY:
   - Mix sentence structures (not all starting the same way)
   - Balance technical depth with business impact across bullets
   - Vary which CRITICAL KEYWORDS appear in which bullets
   - Keep the same number of bullet points per experience as the original

2. SUMMARY (about field):
   
   LENGTH: Maximum 400 characters - be ruthlessly concise
   
   CONTENT:
   - Lead with job-relevant qualifications that match the JD
   - ${extractedKeywords && extractedKeywords.length > 0 ? 'Incorporate 3-5 CRITICAL KEYWORDS naturally' : 'Include key skills and technologies from the JD'}
   - Emphasize quantified achievements or years of experience
   - Mirror the seniority level and tone of the job description
   
   STRUCTURE:
   - 2-3 punchy sentences maximum
   - Front-load the most relevant qualification in first sentence
   - Include 1-2 quantified achievements if possible
   - End with forward-looking statement aligned to role
   
   EXAMPLE (267 chars):
   "Senior Product Manager with 8+ years driving B2B SaaS growth. Led cross-functional teams to launch products generating $12M ARR. Expert in roadmap prioritization, user research, and data-driven decision making. Passionate about building products that solve real customer problems."

3. SKILLS (skills array):
   
   STRATEGY:
   ${extractedKeywords && extractedKeywords.length > 0 ? 
   `- Add CRITICAL KEYWORDS that are technical skills, tools, or platforms to the skills array
   - Don't add soft skills (leadership, communication) or generic terms to skills array
   - Those belong in bullet points and summary only` : 
   `- Only add skills explicitly mentioned in the job description AND relevant to the role
   - Prioritize hard skills: technologies, tools, frameworks, platforms, methodologies
   - Avoid generic soft skills - incorporate those in bullets and summary instead`}
   - Canonicalize skill names (e.g., JS → JavaScript, AWS → Amazon Web Services)
   - Title Case where appropriate (React, PostgreSQL, TensorFlow)
   - Deduplicate - don't add skills already present
   - Keep skills array focused (10-20 items max)
   
   WHERE TO PUT WHAT:
   - Skills array: Technical tools, languages, frameworks, platforms, certifications
   - Bullets/Summary: Soft skills, methodologies in action, leadership qualities

4. PRESERVE STRUCTURE:
   - Do NOT change any IDs (resume.id, experience.id, description.id, skill.id, hobby.id)
   - Do NOT change roles, company names, dates, or order fields
   - Do NOT change the number of experiences or their order
   - Do NOT change the structure of any arrays
   - ONLY modify: description.content, about, and add/remove from skills/hobbies arrays

5. HOBBIES (hobbies array):
   - Keep existing hobbies unless completely irrelevant
   - Only add new hobbies if they're explicitly relevant to the role
   - Less is more - 3-5 hobbies maximum

QUALITY CHECKLIST BEFORE RETURNING:
□ Every bullet point is ≤200 characters
□ Summary is ≤400 characters
□ ${extractedKeywords && extractedKeywords.length > 0 ? 'CRITICAL KEYWORDS appear 5-10 times across bullets and summary' : 'Job description keywords are naturally incorporated throughout'}
□ 60-70% of bullets include quantified outcomes
□ All IDs, roles, and structure preserved exactly
□ Skills array contains only hard/technical skills
□ Bullets use strong action verbs and show impact
□ Summary front-loads most relevant qualification

Return the complete resume JSON with all fields populated. Verify character counts before returning.`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-4.1',
		messages,
		temperature: 0.5,
		max_tokens: 4096,
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
	extractedKeywords,
}: {
	experience: string
	jobTitle: string
	jobDescription: string
	currentJobTitle: string
	currentJobCompany: string
	user: Partial<User>
	extractedKeywords?: string[]
}) => {
	const name = user.name ? user.name.replace(/ /g, '_') : user.username

	const messages =
		jobTitle && jobDescription
			? [
					{
						role: 'system' as const,
						content: `You are an elite resume writer specializing in ${jobTitle} roles with 20 years of experience getting candidates past ATS systems and impressing hiring managers at top companies.

Your expertise: Writing quantified, achievement-focused bullet points that mirror job description language while showcasing measurable impact.

Job Description Context:
${jobDescription}

${extractedKeywords && extractedKeywords.length > 0 ? `
CRITICAL KEYWORDS (must incorporate naturally):
${extractedKeywords.slice(0, 8).join(', ')}

These are the highest-priority terms from the ATS. Use them where relevant.` : ''}`,
					},
					{
						role: 'user' as const,
						content: `Transform this existing resume bullet point for a ${currentJobTitle} at ${currentJobCompany}:

"${experience}"

Generate 10 enhanced versions following these rules:

LENGTH (CRITICAL): 
- Each bullet point (description.content): Maximum 180 characters (about 15-30 words)
- Count characters before returning - reject any bullet over 200 chars
- One-two lines per bullet when rendered on a resume

STRUCTURE (use CAR/STAR):
- Context: What was the situation/scope?
- Action: What did you do? (Use strong verbs: Led, Architected, Optimized, Scaled, Drove, Reduced, Increased)
- Result: What was the measurable outcome? (%, $, time saved, users impacted, uptime, etc.)

ATS OPTIMIZATION:
- Naturally incorporate ${extractedKeywords && extractedKeywords.length > 0 ? 'the CRITICAL KEYWORDS listed above' : 'keywords from the job description (technologies, methodologies, outcomes)'}
- Mirror job description phrasing where it fits naturally
- Front-load important keywords in first 5 words when possible

IMPACT REQUIREMENTS:
- 6-8 bullets MUST include quantified outcomes (numbers, %, $, timelines, scope)
- 2-3 bullets can be process/approach-focused without metrics
- Brevity beats completeness - cut filler words ruthlessly

AUTHENTICITY:
- Keep the core truth of the original bullet - don't fabricate different achievements
- Expand on implied impact (if original says "improved performance", estimate realistic % if the role would have data)
- Stay within the realm of what a ${currentJobTitle} at ${currentJobCompany} would plausibly achieve

VARIETY:
- Mix sentence structures (not all starting the same way)
- Some bullets emphasize technical depth, others business impact
- Vary which CRITICAL KEYWORDS appear in which bullets

Return ONLY a JSON object: { "experiences": ["bullet 1", "bullet 2", ...] }

No markdown, no explanations, just the JSON.`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-4.1',
		messages,
		temperature: 0.5,
		max_tokens: 2048,
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
		model: 'gpt-4.1',
		messages,
		temperature: 0.5,
		max_tokens: 2048,
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
                    Keep the list limited to 10 items. Only 5 should have outcomes. Only supply the experience items, do not include any other text.
                    Modified Experience List:`,
						name,
					},
			  ]
			: null

	invariant(messages, 'Must provide jobTitle and jobDescription')

	const response = await openai.chat.completions.create({
		model: 'gpt-4.1-mini',
		messages,
		temperature: 0.4,
		max_tokens: 1024,
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
		model: 'gpt-4.1-mini',
		messages,
		temperature: 0.4,
		max_tokens: 1024,
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
	console.log('[getJobFit] Function called')
	console.log('[getJobFit] Job title:', jobTitle)
	console.log('[getJobFit] JD length:', jobDescription.length)
	console.log('[getJobFit] Resume type:', typeof resume)
	console.log('[getJobFit] User:', user)

	const name = user.name ? user.name.replace(/ /g, '_') : user.username
	const resumePaylod = typeof resume === 'string' ? `RESUME_TEXT:\n${resume}` : `RESUME_JSON:\n${JSON.stringify(resume)}`

	console.log('[getJobFit] Resume payload length:', resumePaylod.length)

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

	console.log('[getJobFit] About to call OpenAI API...')
	console.log('[getJobFit] Messages count:', messages.length)
	console.log('[getJobFit] Total prompt length:', messages.reduce((sum, m) => sum + m.content.length, 0))

	const startTime = Date.now()
	const response = await openai.chat.completions.create({
		model: 'gpt-5-mini',
		messages,
		temperature: 1, //gpt-5 only supports default temp 1
		max_completion_tokens: 16384,
		response_format: openaiJobFitResponseFormat,
	})

	console.log('[getJobFit] OpenAI API call complete in', Date.now() - startTime, 'ms')
	console.log('[getJobFit] Response choices:', response.choices?.length)

	return { response }
}

export const getQuickTailoredResume = async ({
	parsedResume,
	jobDescription,
	keywords,
	conservativeMode = true,
	additionalContext,
	previousTailoredResume,
}: {
	parsedResume: any
	jobDescription: string
	keywords: string[]
	conservativeMode?: boolean
	additionalContext?: string
	previousTailoredResume?: any
}) => {
	const jobTitle = parsedResume.summary?.title || 'the target role'
	const useAggressiveMode = !conservativeMode

	const systemPrompt = `You are an elite resume strategist who helps professionals across ALL industries position themselves authentically and compellingly for their target roles.

Your expertise spans: Product Management, Software Engineering, Data Science, Design, Marketing, Sales, Operations, Finance, Healthcare, Legal, and every other professional domain.

CRITICAL CONTEXT:
Job Title: ${jobTitle}
Job Description: ${jobDescription}

EXTRACTED KEYWORDS (highest-priority terms):
${keywords.join(', ')}

These keywords represent what the employer values most. Your job is to help the candidate demonstrate they have this experience—authentically.

${previousTailoredResume ? `
🔄 RE-TAILORING MODE - PRESERVE GOOD WORK:
You previously tailored this resume and it had good keyword matches. Here's what you created before:

${JSON.stringify(previousTailoredResume, null, 2)}

CRITICAL INSTRUCTIONS:
1. PRESERVE all keyword-rich bullets and skills from the previous version above
2. PRESERVE strong summary and experience phrasing that was working well
3. ADD new bullets based on the user's additional context (see below)
4. IMPROVE fit assessment if the new context changes the domain match
5. Your goal: EQUAL OR BETTER keyword match than before, not worse

Think of this as BUILDING ON your previous work, not starting over.
` : ''}`

	const metricsInstruction = useAggressiveMode
		? `METRICS APPROACH (AGGRESSIVE MODE):
- Add realistic estimated metrics based on industry standards and role level
- Use ranges when appropriate (e.g., "20-40% improvement")
- Front-load quantified impact in first 5-7 words
- Every bullet should have at least one metric

EXAMPLES:
Original: "Built features for the dashboard"
Aggressive: "Built 12 dashboard features using React, reducing load time 35% and supporting 50K+ daily users"

Original: "Improved team processes"
Aggressive: "Streamlined sprint planning process, reducing meeting time 40% and increasing velocity 25%"`
		: `METRICS APPROACH (CONSERVATIVE MODE - DEFAULT):

🚨 CRITICAL RULES FOR HONEST METRICS:

RULE #1: ALWAYS PRESERVE EXISTING METRICS
- If original has "2K users" → KEEP "2K users" exactly
- If original has "$240K ARR" → KEEP "$240K ARR" exactly
- If original has "50% improvement" → KEEP "50%" exactly
- NEVER change existing numbers to XX
- NEVER modify existing percentages or dollar amounts

RULE #2: USE "XX" ONLY FOR NEW METRICS YOU'RE ADDING
- If you're adding a NEW metric not in original → use XX
- If original is vague and you want to quantify → use XX
- XX means "user should fill this in with their real number"

EXAMPLES:

Example 1 - Preserve existing metrics:
Original: "Scaled product from 0 to 2K paid users, growing ARR to $240K with 10% MRR growth"
✅ CORRECT: "Scaled product from 0 to 2K paid users, growing ARR to $240K with 10% MRR growth"
❌ WRONG: "Scaled product from 0 to XX paid users, growing ARR to $XX with XX% MRR growth"
→ These numbers existed! Keep them!

Example 2 - Use XX for new metrics:
Original: "Built features for the dashboard"
✅ CORRECT: "Built dashboard features using React, improving load time by XX% and supporting XX+ daily users"
❌ WRONG: "Built dashboard features using React, improving load time by 42% and supporting 50K+ daily users"
→ Original had no metrics, so use XX (don't fabricate 42% and 50K)

Example 3 - Mix of existing + new:
Original: "Led team of 5 engineers to reduce costs"
✅ CORRECT: "Led team of 5 engineers to reduce infrastructure costs by XX%, saving $XX annually"
→ Keep "5" (it existed), use XX for missing savings amount
❌ WRONG: "Led team of XX engineers to reduce costs by XX%"
→ Don't replace the existing "5"!`

	const userPrompt = `
═══════════════════════════════════════════════════════════════════
🎯 YOUR MISSION: AUTHENTIC POSITIONING, NOT KEYWORD STUFFING
═══════════════════════════════════════════════════════════════════

Help this candidate present their REAL accomplishments in the most compelling way for THIS specific role.

You are NOT writing a new resume. You are strategically positioning their actual experience.

═══════════════════════════════════════════════════════════════════
⚠️ CRITICAL ANTI-PATTERNS (WHAT NOT TO DO)
═══════════════════════════════════════════════════════════════════

❌ KEYWORD STUFFING:
"Drove workflow integration and knowledge retrieval systems using data fluency and cross-functional collaboration"
→ This is meaningless buzzword soup. No human would write this.

❌ VAGUE GAP BULLETS:
"Collaborated cross-functionally to deliver impactful results"
"Leveraged best practices to optimize outcomes"
→ These could describe any job. Zero credibility.

❌ DOMAIN FABRICATION:
Adding "healthcare experience" when they've never worked in healthcare
Adding "machine learning" when they've only done SQL queries
→ Hiring managers will catch this immediately in interviews

❌ MECHANICAL KEYWORD INSERTION:
Original: "Led team to ship features"
Bad: "Led team to ship workflow integration features with knowledge retrieval systems"
→ Just inserted keywords without adding real information

═══════════════════════════════════════════════════════════════════
✅ CORRECT APPROACH: SPECIFIC, AUTHENTIC, INTERVIEW-READY
═══════════════════════════════════════════════════════════════════

PRINCIPLE 1: SPECIFICITY = CREDIBILITY

Keep every specific detail from the original:
- Exact numbers (2K users, $240K, 50% improvement)
- Product names (Live Edit, CoachConvo, Resume Tailor)
- Technologies mentioned (React, SQL, Figma)
- Methodologies used (A/B testing, user interviews)

Why? Specific details prove they did the work. Generic claims prove nothing.

PRINCIPLE 2: NATURAL KEYWORD INTEGRATION

Keywords should describe what they actually did, not be forced in:

Good: If they analyzed data → "Analyzed XX user sessions with SQL..."
Bad: If they never used SQL → Don't add SQL references

Good: If they worked with designers → "Collaborated with design team on XX features..."
Bad: If they worked alone → Don't add "cross-functional collaboration"

3 authentic keyword mentions > 10 forced mentions

PRINCIPLE 3: THE INTERVIEW TEST

Every bullet must pass this test:
"Could this person tell a detailed 2-minute story about this in an interview?"

If YES (has context, specific actions, measurable outcomes) → Keep it
If NO (too vague, just buzzwords) → Rewrite or remove

PRINCIPLE 4: RESPECT DOMAIN BOUNDARIES

Only claim experience they actually have evidence for:
- Don't add "clinical knowledge" if they've never worked in healthcare
- Don't add "machine learning" if they've only done data analysis
- Don't add "enterprise sales" if they've only done B2C

Adjacent experience is OK to reframe (see Tier 2 below), but don't fabricate domains.

═══════════════════════════════════════════════════════════════════
📊 HONEST KEYWORD INTEGRATION FRAMEWORK
═══════════════════════════════════════════════════════════════════

Categorize EVERY keyword into three tiers:

TIER 1 - DIRECT MATCH (add to skills, use in bullets naturally):
✅ User has explicit, provable experience with this
✅ Can be verified in their work history
✅ They could discuss this confidently in an interview

Examples:
- User worked with "JIRA" → Add "JIRA" to skills
- User did "A/B testing" → Mention "A/B testing" in bullets
- User used "SQL" → Reference "SQL" in relevant bullets

TIER 2 - ADJACENT MATCH (reframe experience, DON'T add to skills directly):
⚠️ User has transferable but not direct experience
⚠️ Can't claim it directly, but can show parallels
⚠️ Reframe existing work to show transferability

Examples:
- User built AI products + JD wants "drug discovery AI"
  → Reframe: "Built AI platform serving knowledge workers in domain-specific workflows"
  → Shows: Experience building for expert users in complex domains
  → Don't add: "drug discovery" to skills (they haven't done it)

- User managed tech startups + JD wants "biotech experience"
  → Reframe: "Advised 10+ technical startups on scaling complex products"
  → Shows: Pattern recognition across technical domains
  → Don't add: "biotech" to skills (they haven't worked in biotech)

- User built B2C SaaS + JD wants "enterprise software"
  → Reframe: "Scaled SaaS platform from 0 to 115K users with high data security requirements"
  → Shows: Scaling ability, security consciousness
  → Don't add: "enterprise software" (different go-to-market)

TIER 3 - NO MATCH (ignore completely):
❌ User has zero relevant experience
❌ Would require fabrication to claim
❌ Too big a domain leap

Examples:
- User in B2C tech + JD wants "clinical trials" → SKIP (completely different domain)
- User is IC engineer + JD wants "VP-level strategy" → SKIP (wrong seniority)
- User knows Python + JD wants "Rust expertise" → SKIP (different language)

═══════════════════════════════════════════════════════════════════
📝 BULLET POINT CRAFTING (UNIVERSAL STRUCTURE)
═══════════════════════════════════════════════════════════════════

Every bullet should follow CAR/STAR format:

C - CONTEXT: What was the situation/scope?
A - ACTION: What specific actions did you take? (use strong verbs)
R - RESULT: What was the measurable outcome?

Length: Maximum 180 characters
Keywords: Maximum 1-2 per bullet (don't stuff)
Metrics: At least 1-2 per bullet (existing or XX)

STRONG ACTION VERBS BY ROLE:

Product/Strategy: Scaled, Launched, Drove, Owned, Defined, Shipped, Prioritized
Engineering: Built, Architected, Optimized, Deployed, Refactored, Designed, Implemented
Data/Analytics: Analyzed, Modeled, Built (pipelines), Deployed, Optimized, Identified
Design: Designed, Prototyped, Conducted (research), Created, Improved, Redesigned
Marketing/Growth: Launched, Grew, Optimized, Generated, Increased, Drove, Scaled
Sales: Closed, Generated, Exceeded, Negotiated, Onboarded, Grew, Converted
Operations: Streamlined, Automated, Reduced, Improved, Coordinated, Optimized

EXAMPLES BY ROLE:

Product Manager:
Bad: "Worked on product features and collaborated with teams"
Good: "Shipped referral program driving 2,300 signups in Q1 at $12 CAC vs. $89 paid acquisition"
→ Specific feature, specific metrics, specific comparison

Software Engineer:
Bad: "Optimized backend services for better performance"
Good: "Refactored checkout service reducing p95 latency from 2.1s to 340ms at 50K requests/day"
→ Specific component, specific metrics, specific scale

Data Scientist:
Bad: "Built machine learning models to predict outcomes"
Good: "Built churn prediction model (XGBoost) achieving 0.84 AUC, preventing $340K annual revenue loss"
→ Specific technique, specific performance, specific business impact

Designer:
Bad: "Improved user experience through design thinking"
Good: "Redesigned checkout flow reducing cart abandonment from 68% to 41%, adding $1.2M annual revenue"
→ Specific flow, specific improvement, specific business outcome

Sales:
Bad: "Exceeded quota through consultative selling"
Good: "Closed 23 enterprise deals ($2.4M total) at 34% win rate, 28% above team average"
→ Specific volume, specific amount, specific benchmark

${metricsInstruction}

═══════════════════════════════════════════════════════════════════
🎯 GAP ANALYSIS: STRATEGIC BULLET ADDITIONS (STRICT RULES)
═══════════════════════════════════════════════════════════════════

After enhancing existing bullets, identify HIGH-IMPACT gaps to add.

🚨 CRITICAL: BE EXTREMELY CONSERVATIVE ABOUT ADDING GAP BULLETS 🚨

Before adding ANY gap bullet, ask these questions in order:

QUESTION 1: Is there EXPLICIT evidence in the original resume they did this activity?
- If YES → Don't add a gap bullet, just REWRITE their existing bullet more clearly
- If NO → Go to Question 2

QUESTION 2: Is this a UNIVERSAL activity that literally everyone in their role does?
- Examples of UNIVERSAL activities:
  - Product Manager → "wrote product briefs", "prioritized roadmap", "ran standups"
  - Software Engineer → "wrote code reviews", "fixed bugs", "wrote tests"
  - Designer → "created mockups", "ran user tests", "iterated on designs"
  - Data Scientist → "wrote SQL queries", "built models", "presented insights"
- If YES → Can add (they definitely did this, just didn't mention it)
- If NO → Go to Question 3

QUESTION 3: Is this a DOMAIN-SPECIFIC activity that only people in certain industries do?
- Examples of DOMAIN-SPECIFIC activities:
  - "shadowed clinicians" → ONLY healthcare PMs do this
  - "navigated HIPAA compliance" → ONLY regulated health PMs do this
  - "worked with legal counsel on contracts" → ONLY certain enterprise PMs do this
  - "analyzed clinical trial data" → ONLY healthcare/pharma data scientists do this
  - "designed medical device interfaces" → ONLY medical device designers do this
- If YES (domain-specific) → DO NOT ADD unless they explicitly worked in that domain
- If NO (universal) → Go to Question 4

QUESTION 4: Would they have mentioned this if they actually did it?
- If this activity is impressive/notable, they would have put it in their original resume
- If it's missing, assume they DIDN'T do it, not that they forgot to mention it
- Example: "Led 10-person cross-functional team" is impressive → if they did it, they'd mention it
- Example: "Wrote daily standups notes" is mundane → maybe they did it but forgot to mention it

DECISION TREE:

Original resume has explicit evidence of activity → REWRITE existing bullet (not a gap)
↓
Activity is UNIVERSAL to their role (all PMs/Engineers/Designers do this) → CAN ADD
↓
Activity is DOMAIN-SPECIFIC → Check if they worked in that domain
  ↓ YES (worked in domain) → CAN ADD (but be cautious)
  ↓ NO (no domain experience) → DO NOT ADD (would be fabrication)
↓
Activity is impressive/notable → If not in original resume, assume they DIDN'T do it → DO NOT ADD

EXAMPLES:

Example 1: Product Manager at Consumer SaaS Company
JD wants: "SQL expertise"
Original resume: No mention of SQL

✅ CAN ADD: "Wrote XX SQL queries to analyze user behavior and identify XX key insights"
→ This is UNIVERSAL PM work (data analysis), just making it explicit

❌ DON'T ADD: "Built SQL-based reporting dashboard for executive team"
→ This is impressive/specific. If they did it, they would have mentioned it.

Example 2: Product Manager at Consumer SaaS Company
JD wants: "healthcare experience, shadowing clinicians"
Original resume: No healthcare experience mentioned

❌ DON'T ADD: "Shadowed XX clinicians to map clinical workflows"
→ This is DOMAIN-SPECIFIC. They didn't work in healthcare, so they didn't do this.

❌ DON'T ADD: "Conducted user research with healthcare professionals"
→ This is DOMAIN-SPECIFIC. No evidence they worked with healthcare users.

✅ COULD ADD (if truly universal): "Conducted XX user interviews to understand workflow pain points"
→ This is UNIVERSAL PM work, not domain-specific

Example 3: Product Manager at Healthcare Company
JD wants: "clinical workflow understanding"
Original resume: "Product Manager at Apollo Medical" (vague, no details)

❌ DON'T ADD: "Shadowed clinicians to map documentation workflows"
→ Even though they worked at a healthcare company, there's NO EVIDENCE they did this
→ "Apollo Medical" could be a patient-facing app, admin tool, billing system, etc.
→ If they actually shadowed clinicians, they would have mentioned it prominently

✅ COULD ADD (if truly plausible): "Conducted XX user interviews with healthcare stakeholders to identify workflow inefficiencies"
→ More generic, could apply to any healthcare role
→ But still be cautious - if no evidence of user research in original resume, don't add

Example 4: Software Engineer
JD wants: "mentorship, code reviews"
Original resume: "Senior Software Engineer" title but no mention of mentorship

✅ CAN ADD: "Conducted XX code reviews per week, mentoring junior engineers on best practices"
→ This is UNIVERSAL for senior engineers - they all do code reviews
→ Plausible they forgot to mention this mundane activity

❌ DON'T ADD: "Led architecture decisions for team of 10 engineers"
→ This is impressive leadership. If they did it, they would have mentioned it.

Example 5: Designer applying to Healthcare Design Role
JD wants: "healthcare experience, designing for clinical workflows"
Original resume: Only consumer app design experience

❌ DON'T ADD: "Designed clinical workflow interfaces for healthcare providers"
→ DOMAIN-SPECIFIC. No evidence they worked in healthcare.

❌ DON'T ADD: "Conducted usability testing with medical professionals"
→ DOMAIN-SPECIFIC. No evidence they worked with medical users.

✅ COULD ADD: "Conducted XX usability tests with professional users, iterating designs based on feedback"
→ UNIVERSAL design work, not domain-specific
→ But be careful not to imply they tested with medical professionals

GOLDEN RULE FOR GAP BULLETS:

If adding the bullet requires assuming they did something they didn't mention, DON'T ADD IT.

The only exception: Truly universal, mundane activities that everyone in their role does (standups, basic prioritization, routine meetings).

For anything impressive, domain-specific, or notable: If it's not in their original resume, they didn't do it.

PRIORITIZATION ORDER (After passing all the above checks):

🥇 TYPE 2 TECHNICAL GAPS (HIGHEST PRIORITY):
Add these FIRST if JD has technical requirements

Product Manager + JD wants "API understanding":
→ "Collaborated with engineering on XX REST API integrations, defining XX endpoints and data schemas that reduced integration time by XX%"

Product Manager + JD wants "SQL/data analysis":
→ "Wrote XX SQL queries analyzing XX million user events, identifying XX key insights that drove XX% conversion improvement"

Software Engineer + JD wants "system design":
→ "Architected XX microservice handling XX requests/sec with XX% uptime, implementing caching strategy that reduced latency XX%"

Data Scientist + JD wants "production ML":
→ "Deployed XX ML models to production processing XX predictions/day with XX% accuracy, monitored via XX dashboard"

Designer + JD wants "design systems":
→ "Created XX design system components in Figma used across XX products, reducing design-to-dev time by XX%"

🥈 TYPE 2 STANDOUT GAPS (SECOND PRIORITY):
Add these if no technical gaps, or after technical gaps

Any Senior role + JD wants "mentorship":
→ "Mentored XX junior [role]s on [skill], improving team velocity by XX% and reducing onboarding time to XX weeks"

Any role + JD emphasizes "process improvement":
→ "Identified XX bottlenecks in [process], implementing XX changes that reduced cycle time from XX to XX days"

Startup role + JD wants "0-to-1 experience":
→ "Launched [product] from scratch reaching XX users in XX months through rapid experimentation (XX tests/month)"

🥉 TYPE 1 ROLE-STANDARD GAPS (LOWEST PRIORITY):
Only add these if no Type 2 gaps apply

Product Manager (standard):
→ "Authored XX product briefs for engineering, reducing spec-to-dev handoff time by XX%"

Engineer (standard):
→ "Conducted XX code reviews per week, maintaining XX% code coverage and XX production bug rate"

QUALITY STANDARDS FOR GAP BULLETS:

✅ GOOD (specific enough to fill in):
"Analyzed XX customer support tickets identifying XX recurring workflow issues that informed XX product decisions"
→ User can fill in real numbers

✅ GOOD (plausible given role):
For healthcare PM: "Shadowed XX clinicians for XX hours documenting XX workflow bottlenecks"
→ Makes sense for someone building healthcare products

❌ BAD (too vague):
"Collaborated cross-functionally to deliver projects"
→ Could mean anything, zero credibility

❌ BAD (implausible):
For junior engineer: "Led architecture decisions for distributed systems serving 1B+ users"
→ Doesn't match seniority level

PLACEMENT:
- Add to MOST RELEVANT job (usually most recent, or best JD match)
- Place AFTER existing bullets
- Maximum 2-3 gap bullets per job
- Gap bullets should have 2-3 XX placeholders each

═══════════════════════════════════════════════════════════════════
🎨 SUMMARY CRAFTING
═══════════════════════════════════════════════════════════════════

The summary is your 10-second pitch. Make it count.

STRUCTURE:
1. Lead with most impressive, relevant achievement (8-12 words)
2. Follow with 2-3 supporting achievements/skills (15-20 words)
3. Include 2-3 top keywords naturally
4. Maximum 400 characters total

BAD SUMMARIES (generic, keyword-stuffed):
"Product manager with 5+ years experience in digital products and agile methodologies"
→ Could describe anyone

"Results-driven professional leveraging data-driven insights to optimize outcomes"
→ Meaningless buzzwords

GOOD SUMMARIES (specific, achievement-led):
"Scaled AI SaaS from 0 to $240K ARR (2K paid users, 115K total) in 18 months. Expert in 0-to-1 product launches, growth experimentation (100+ A/B tests), and SQL-driven insights."
→ Specific numbers, specific achievements, natural keywords

"Full-stack engineer specializing in high-scale systems. Built payment infrastructure handling 2M transactions/day ($500M annual volume) with 99.99% uptime. Expert in Python, PostgreSQL, AWS."
→ Specific domain, specific scale, technical depth

"Product designer who increased Square's onboarding conversion 47% (adding $12M annual revenue). Expert in user research, design systems, and data-driven experimentation."
→ Specific company, specific impact, specific methods

FORMULA:
[Scaled/Built/Grew] [specific thing] from [X] to [Y] [timeframe]. [Expert in / Led / Shipped] [2-3 relevant capabilities with specifics].

═══════════════════════════════════════════════════════════════════
🎯 SKILLS ARRAY STRATEGY
═══════════════════════════════════════════════════════════════════

Don't just list everything. Strategically order skills.

PRIORITY ORDER:

1. JOB-TITLE-INFERRED SKILLS (if JD mentions them):
   If user's title is "Product Manager" and JD wants "product management" → Add it first
   If user's title is "Data Scientist" and JD wants "data science" → Add it first

2. TIER 1 KEYWORDS (direct matches from JD):
   Skills they clearly have and JD wants

3. EXISTING SKILLS (from original resume):
   Keep all legitimate skills they listed

4. ADJACENT SKILLS (careful - only if clear transferability):
   Only add if there's clear evidence in their experience

FORMATTING:
- Front-load most important/relevant skills
- Use bullet points (•) to separate
- Include both broad (product management) and specific (SQL, JIRA) skills
- Aim for 15-30 skills total (not more)

EXAMPLE:
"product management • product strategy • SQL • data analysis • 0-to-1 product launches • A/B testing • user research • Python • JIRA • Figma • cross-functional leadership • agile • roadmap planning • stakeholder management • API design"
→ Most important first, natural mix of broad and specific

═══════════════════════════════════════════════════════════════════
⚠️ ENHANCED FIT WARNING SYSTEM WITH REALITY CHECK
═══════════════════════════════════════════════════════════════════

Assess fit honestly. Don't sugarcoat mismatches. Your job is NOT to help users apply to jobs they're unqualified for.

RED WARNING TRIGGERS (Be brutally honest):

1. DOMAIN EXPERTISE MISMATCH (Most critical):
   - JD requires deep domain knowledge (clinical, legal, finance, regulated industries)
   - User has <2 years in that domain OR experience is vague/unclear
   - Example: Clinical AI role + user has 1 vague "digital health" role from years ago with no specifics

2. VAGUE CRITICAL EXPERIENCE:
   - User's most relevant experience is described generically with no details
   - Can't tell what they actually built, who they built it for, or what impact they had
   - Example: "Digital health platform" with no details on users, clinical problem, or outcomes
   - Example: "Healthcare company" with no explanation of what product, what user type, what domain

3. FABRICATED EXPERTISE RISK:
   - You would need to add gap bullets claiming domain-specific activities user might not have done
   - No evidence in original resume of these domain-specific activities
   - Example: Adding "shadowed clinicians" when original resume has no mention of clinical observation
   - Example: Adding "navigated HIPAA compliance" when no evidence they worked on regulated products

4. ROLE TYPE FUNDAMENTAL MISMATCH:
   - Different user base (B2C consumers → enterprise buyers or specialized professionals)
   - Different problem space (consumer tools → professional/clinical decision support)
   - Different go-to-market (self-serve → sales-led, or vice versa)
   - Different scale (10x+ gap in revenue, users, team size)

5. EXPERIENCE FABRICATION REQUIRED:
   - The only way to appear qualified would be to fabricate or significantly exaggerate experience
   - Gap analysis reveals 3+ major missing domain-specific competencies
   - Original resume would need wholesale rewriting to appear qualified

YELLOW WARNING TRIGGERS:

1. ADJACENT DOMAIN (Transferable):
   - Related but not identical domain (B2C SaaS → B2B SaaS, tech → fintech)
   - Transferable skills but not direct experience
   - User could reasonably learn the new domain

2. EXPERIENCE SLIGHTLY UNDER:
   - 1-2 years under requirement (4 YOE when JD wants 5-6)
   - But relevant experience quality is strong and role type matches

3. MISSING SECONDARY REQUIREMENTS:
   - Missing nice-to-have skills (not core requirements)
   - Core requirements are clearly met
   - Skills could be learned on the job

FIT WARNING RESPONSE FORMAT:

For RED warnings, include "hard_questions" and "recommendation":

{
  "fit_warning": {
    "level": "red",
    "reasons": [
      "Specific, brutally honest assessment of each mismatch",
      "Call out vague experience that needs clarification",
      "Flag any gap bullets that might be fabricated"
    ],
    "hard_questions": [
      "Questions user MUST answer confidently before applying",
      "Questions that will expose if they're faking expertise",
      "Questions interviewers will definitely ask"
    ],
    "recommendation": "Direct advice: Should they apply or not? Be honest.",
    "alternative_suggestion": "What roles WOULD be a good fit given their actual experience?"
  }
}

For YELLOW warnings, include "suggestions" instead:

{
  "fit_warning": {
    "level": "yellow",
    "reasons": [
      "Specific mismatch that's addressable"
    ],
    "hard_questions": [
      "Questions to help user assess if they're genuinely interested"
    ],
    "suggestions": [
      "How to position their transferable experience",
      "What to emphasize in their application"
    ]
  }
}

EXAMPLES:

Red Warning - Clinical AI Role (User has vague healthcare experience):
{
  "level": "red",
  "reasons": [
    "This role requires deep clinical domain expertise - you have 1 vague healthcare role (Apollo Medical, 2020-2022) with no specific details about what you built or for whom",
    "Heidi wants someone who understands how clinicians search for medical knowledge during patient care - no evidence in your resume that you understand this workflow or have worked with clinicians",
    "I would need to add gap bullets like 'shadowed clinicians to map workflows' that aren't in your original resume - if you actually did this, you would have mentioned it prominently",
    "Your strongest, most detailed product experience (Resume Tailor AI) is consumer SaaS for job seekers, not healthcare professionals - fundamentally different user base and problem space"
  ],
  "hard_questions": [
    "What exactly was Apollo Medical? What product did you build, who were the users (patients or clinicians?), and what problem did it solve?",
    "Did you actually shadow clinicians at Apollo Medical? How many? For how long? What specific clinical workflow insights did you gain that you could discuss in an interview?",
    "Can you explain the difference between how a job seeker searches for resume keywords vs. how a clinician searches for medical knowledge during active patient care?",
    "Why did you leave Apollo Medical after only 2 years? What did you learn about healthcare that makes you qualified for a role building clinical decision support tools?"
  ],
  "recommendation": "STOP: Do not apply to this role unless you can confidently answer all of the above questions with specific details. If your Apollo Medical experience was vague (e.g., worked on a patient-facing app, not a clinical tool), you are not qualified for this role. Applying anyway risks: (1) wasting your time on a doomed application, (2) damaging your reputation with a company you might want to work for in the future, and (3) interview embarrassment when you can't answer basic clinical workflow questions. Be honest with yourself about what you actually know.",
  "alternative_suggestion": "Consider roles that value your PROVEN strengths: 0-to-1 consumer SaaS, AI-powered tools, growth experimentation, self-serve products. Look for AI product roles in domains where you have genuine, demonstrable expertise (career tools, productivity, education). If you want to break into healthcare, look for entry-level healthcare PM roles or consumer health (not clinical) roles where you can build genuine domain knowledge first."
}

Red Warning - Enterprise B2B Role (User only has B2C experience):
{
  "level": "red",
  "reasons": [
    "This role requires enterprise B2B sales cycle experience - you've only worked on B2C/freemium products with self-serve conversion",
    "JD emphasizes procurement processes, security reviews, multi-stakeholder buying committees - zero evidence you've navigated these (and you haven't based on your B2C background)",
    "Your revenue scale ($210K ARR, 2K paid users) is 100x smaller than what this role requires ($50M+ ARR, 500+ enterprise customers) - completely different business"
  ],
  "hard_questions": [
    "Have you ever sold to a procurement team or navigated an enterprise security review? (Be honest - the answer is likely no)",
    "Can you explain the difference between optimizing free-to-paid conversion funnels vs. closing a 6-month enterprise sales cycle with multiple stakeholders?",
    "What's the longest sales cycle you've ever been involved in? (This role averages 4-6 months per deal with 5+ decision makers)"
  ],
  "recommendation": "This is not a fit. Enterprise B2B and B2C freemium are fundamentally different businesses requiring different product approaches, pricing strategies, and customer success models. Your B2C experience is valuable, but not for this role. Applying anyway will result in a quick rejection once they realize you don't understand enterprise buying processes.",
  "alternative_suggestion": "Look for 'Product-Led Growth' roles at companies with both self-serve AND enterprise tiers (e.g., Slack, Notion, Figma model). This would let you leverage your proven B2C experience while learning enterprise motion. Alternatively, look for pure B2C SaaS roles where your background is a direct fit."
}

Red Warning - Domain-Specific Role (User has no domain experience):
{
  "level": "red",
  "reasons": [
    "This role requires legal tech domain expertise - you have zero legal industry experience",
    "JD wants someone who understands law firm workflows, legal research, case management - no evidence you understand any of these domains",
    "All your experience is in consumer products (job search, resume building) - completely different user base, problem space, and buyer"
  ],
  "hard_questions": [
    "Do you understand how lawyers conduct legal research? What tools do they use? What pain points do they have?",
    "Have you ever worked with law firms or legal professionals? Can you name the key workflows in a law firm?",
    "Why do you want to work in legal tech specifically? (If the answer is 'I just want a PM job', that's not good enough)"
  ],
  "recommendation": "Do not apply. You have no legal domain knowledge, and this role requires it. They will ask domain-specific questions in the interview and you won't be able to answer them. This will damage your credibility.",
  "alternative_suggestion": "Focus on roles in domains where you have actual experience or genuine interest. If you want to pivot to legal tech, start by: (1) informational interviews with legal tech PMs to learn the domain, (2) entry-level roles at legal tech companies, or (3) roles at companies serving multiple verticals where legal is one of many."
}

Yellow Warning - Adjacent Domain (Transferable skills):
{
  "level": "yellow",
  "reasons": [
    "JD wants fintech experience, you have general SaaS - related but not identical domain",
    "JD emphasizes regulatory compliance (payments, KYC/AML), you have general product experience but no regulated industry background"
  ],
  "hard_questions": [
    "Why are you interested in fintech specifically? What about payments/financial services excites you?",
    "Are you comfortable learning complex regulatory requirements (PCI-DSS, KYC/AML, financial regulations)?",
    "Do you understand the difference between building a consumer app vs. a product that handles money and must comply with financial regulations?"
  ],
  "suggestions": [
    "This is worth applying to IF you can articulate genuine interest in fintech and demonstrated ability to learn complex, regulated problem spaces quickly",
    "In your cover letter, acknowledge the domain gap and emphasize your ability to learn new domains (provide examples from past roles)",
    "Research fintech basics before the interview - understand common terms (KYC, AML, PCI-DSS, ACH, card networks) so you can speak intelligently about the space"
  ]
}

Yellow Warning - Slightly Under on Experience:
{
  "level": "yellow",
  "reasons": [
    "JD requests 6+ years PM experience, you have 5 years - close but slightly under",
    "Your experience quality is strong (0-to-1 launches, growth experimentation, AI products) and domain matches (B2C SaaS)"
  ],
  "suggestions": [
    "Emphasize the DEPTH of your 5 years - multiple 0-to-1 launches, ownership of entire product lifecycle, measurable business impact",
    "In summary, lead with your most impressive achievement to immediately demonstrate senior-level impact",
    "Don't draw attention to the experience gap - let your accomplishments speak for themselves"
  ]
}

═══════════════════════════════════════════════════════════════════
CRITICAL: BE HONEST ABOUT FIT - THIS IS YOUR MOST IMPORTANT JOB
═══════════════════════════════════════════════════════════════════

Your job is NOT to help users apply to jobs they're not qualified for.
Your job is NOT to help users fake expertise they don't have.

Your job IS to:
1. Position their REAL experience compellingly for roles where they ARE qualified
2. Warn them honestly when they're NOT qualified
3. Suggest alternative roles that match their actual experience

If the fit is bad, SAY SO CLEARLY. A red warning might save them from:
- Wasting weeks on a doomed application
- Damaging their reputation with a company they actually want to work for later
- Interview embarrassment when they can't answer domain-specific questions
- Being blacklisted by recruiters who realize they oversold their experience

Better to be brutally honest and suggest alternative roles than to help them fake expertise.

The best resume in the world can't overcome a fundamental experience mismatch.

═══════════════════════════════════════════════════════════════════
📋 FINAL QUALITY CHECKLIST
═══════════════════════════════════════════════════════════════════

Before returning the tailored resume, verify:

✅ SPECIFICITY:
- Does each bullet have specific numbers, products, or outcomes?
- Are details specific enough to verify in an interview?

✅ AUTHENTICITY:
- Would a skeptical hiring manager believe these claims?
- Could the user defend every statement?
- Have you respected domain boundaries?

✅ KEYWORD STRATEGY:
- Are keywords used naturally, not stuffed?
- Is there appropriate keyword density (not too much, not too little)?
- Are keywords distributed strategically (summary, bullets, skills)?

✅ IMPACT FOCUS:
- Does each bullet show measurable impact?
- Are achievements quantified (with real numbers or XX)?
- Would this impress both ATS and human readers?

✅ CONSISTENCY:
- Do job titles, companies, and dates match original?
- Are all existing metrics preserved unchanged?
- Is the tone professional and authentic?

✅ FIT ASSESSMENT:
- If there are major mismatches, is fit_warning included?
- Are warnings specific and actionable?

✅ GAP BULLETS (CRITICAL):
- Did you only add UNIVERSAL activities that everyone in their role does?
- Did you avoid adding DOMAIN-SPECIFIC activities they have no evidence of doing?
- Did you avoid adding impressive/notable activities they would have mentioned?
- For each gap bullet, can you confidently say "they definitely did this" vs. "they might have done this"?
- If the answer is "might have" → Remove the gap bullet

═══════════════════════════════════════════════════════════════════
🚨 FINAL CRITICAL REMINDER BEFORE GENERATING RESPONSE
═══════════════════════════════════════════════════════════════════

Before you generate the final JSON, ask yourself these questions:

1. GAP BULLETS CHECK:
   - Review EVERY gap bullet you're adding
   - For each one, ask: "Is there explicit evidence in the original resume they did this?"
   - If NO evidence, ask: "Is this truly UNIVERSAL to their role, or is it domain-specific?"
   - If DOMAIN-SPECIFIC (e.g., "shadowed clinicians", "navigated HIPAA", "worked with legal"), ask: "Do they actually have experience in that domain, or am I fabricating it?"
   - If you're fabricating domain experience → REMOVE THE GAP BULLET and ADD A RED FIT WARNING

2. FIT WARNING CHECK:
   - Does the JD require domain expertise the user doesn't clearly have?
   - Is their relevant experience vague or unclear?
   - Would I need to add domain-specific gap bullets to make them look qualified?
   - If YES to any → ADD A RED FIT WARNING with hard questions

3. AUTHENTICITY CHECK:
   - Would a skeptical hiring manager believe every claim in this resume?
   - Could the user confidently answer detailed questions about every bullet point?
   - Did I avoid keyword stuffing and domain fabrication?
   - If NO to any → Revise the bullets to be more honest

4. THE ULTIMATE TEST:
   - If this user got an interview, would they be embarrassed when asked to elaborate on any bullet?
   - If YES → Remove or revise that bullet

Remember: Your job is to help them present their REAL experience compellingly, not to help them fake experience they don't have.

A red warning that prevents a bad application is more valuable than a tailored resume that gets them rejected in the interview.

═══════════════════════════════════════════════════════════════════
📄 RESPONSE FORMAT
═══════════════════════════════════════════════════════════════════

Return ONLY valid JSON in this EXACT structure:

{
  "personal_info": {
    "full_name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string (optional)",
    "github": "string (optional)",
    "portfolio": "string (optional)"
  },
  "summary": "string (max 400 chars)",
  "experiences": [
    {
      "id": "string (preserve from original)",
      "title": "string (preserve from original)",
      "company": "string (preserve from original)",
      "date_start": "string (preserve from original)",
      "date_end": "string or null (preserve from original)",
      "date_start_precision": "string (preserve from original)",
      "date_end_precision": "string or null (preserve from original)",
      "location": "string or null",
      "description": "string or null",
      "bullet_points": [
        "string (max 180 chars each)"
      ],
      "skills": ["string array - skills relevant to this role"]
    }
  ],
  "education": [
    {
      "id": "string (preserve from original)",
      "degree": "string (preserve from original)",
      "school": "string (preserve from original)",
      "year": "string (preserve from original)",
      "gpa": "string or null",
      "honors": "string or null"
    }
  ],
  "skills": ["string array - strategically ordered"],
  "certifications": ["array or null"],
  "projects": ["array or null"],
  "awards": ["array or null"],
  "publications": ["array or null"],
  "volunteer": ["array or null"],
  "fit_warning": {
    "level": "yellow" | "red" | null,
    "reasons": ["string array - specific, honest assessments"],
    "hard_questions": ["string array - questions user must answer before applying"] (REQUIRED for red warnings),
    "suggestions": ["string array - how to position experience"] (for yellow warnings),
    "recommendation": "string - direct advice on whether to apply" (REQUIRED for red warnings),
    "alternative_suggestion": "string - what roles would be a better fit" (REQUIRED for red warnings)
  } | null
}

IMPORTANT FIT_WARNING FIELD REQUIREMENTS:

For RED warnings, MUST include:
- reasons (array)
- hard_questions (array)
- recommendation (string)
- alternative_suggestion (string)

For YELLOW warnings, include:
- reasons (array)
- hard_questions (array, optional but recommended)
- suggestions (array)

For null (no warning):
- fit_warning: null

Your response must be ONLY valid JSON. No markdown, no code fences, no explanatory text.

Start with { and end with }. Nothing before or after.

═══════════════════════════════════════════════════════════════════
📊 ORIGINAL RESUME TO TAILOR
═══════════════════════════════════════════════════════════════════

${JSON.stringify(parsedResume, null, 2)}

═══════════════════════════════════════════════════════════════════
${additionalContext ? `📝 ADDITIONAL CONTEXT FROM USER (CRITICAL - READ CAREFULLY)
═══════════════════════════════════════════════════════════════════

The user provided this additional context about their experience:

"${additionalContext}"

🚨 CRITICAL INSTRUCTIONS FOR USING THIS CONTEXT:

1. EVALUATE SPECIFICITY:
   - Is this context SPECIFIC and DETAILED (names of people, companies, workflows, metrics, specific tasks)?
   - Or is it VAGUE and generic ("I worked with healthcare", "I understand workflows", "I built systems")?

2. IF CONTEXT IS SPECIFIC (use it):
   ✅ Contains specific details: Names of agencies, number of shadowing hours, specific workflows mapped, specific compliance work, specific stakeholders
   ✅ Provides verifiable evidence: Can be checked in an interview
   ✅ Changes the fit assessment: Provides domain expertise that wasn't clear in original resume

   THEN:
   - Use this information to ADD specific bullets to relevant experience sections
   - DOWNGRADE or REMOVE fit warnings (red → yellow or yellow → none) if context proves they have the required expertise
   - Update skills array with any new relevant skills mentioned in context

3. IF CONTEXT IS VAGUE (ignore it, keep warnings):
   ❌ Generic statements: "I worked in healthcare", "I understood user needs", "I collaborated with teams"
   ❌ No specific details: No names, numbers, workflows, outcomes
   ❌ Doesn't actually prove domain expertise

   THEN:
   - DO NOT add bullets based on vague context
   - KEEP fit warnings as-is (don't downgrade)
   - Treat this the same as if no context was provided

4. EXAMPLES:

   VAGUE CONTEXT (don't use):
   "I worked in healthcare and understood clinician needs"
   → Still issue RED warning, this is too vague

   "At Apollo Medical, I worked with healthcare professionals to build better tools"
   → Still issue RED warning, no specific details about what, who, or outcomes

   SPECIFIC CONTEXT (use it):
   "At Apollo Medical, I spent 60 hours shadowing 8 clinicians at Tampa General Hospital. I mapped their documentation workflow from patient intake through discharge, identifying 4 key bottlenecks. We built a HIPAA-compliant documentation system that reduced charting time from 45min to 12min per patient."
   → This is SPECIFIC enough to add bullets and potentially downgrade to YELLOW warning or remove warning

   "I led procurement discussions with 3 government agencies: VA Hospital Network (2021), CMS Regional Office (2022), and Indian Health Services (2022). Each required 6-month contracting cycles navigating FAR compliance. The Apollo Medical platform served 5,000+ veterans across 12 VA clinics."
   → This is SPECIFIC enough to add bullets and potentially remove RED warning entirely

5. WHAT TO DO WITH SPECIFIC CONTEXT:

   - ADD bullets to the most relevant experience section (usually the one mentioned in context)
   - Use the SPECIFIC details provided (numbers, names, workflows, outcomes)
   - Frame bullets using CAR/STAR format
   - Make sure bullets would pass the interview test (user can elaborate on these for 2 minutes)

   Example bullet from specific context:
   "Shadowed 8 clinicians for 60 hours at Tampa General Hospital, mapping patient documentation workflows and identifying 4 critical bottlenecks that informed product roadmap"

6. FIT ASSESSMENT WITH CONTEXT:

   - If context provides SPECIFIC domain expertise that was missing → Downgrade or remove fit warning
   - If context is VAGUE or doesn't prove expertise → Keep fit warning as-is
   - In fit_warning reasoning, acknowledge the context but explain why it's not sufficient (if vague)

═══════════════════════════════════════════════════════════════════
` : ''}
🚨 MANDATORY FIT ASSESSMENT (YOU MUST RESPOND TO THIS)
═══════════════════════════════════════════════════════════════════

Before returning the tailored resume JSON, you MUST explicitly evaluate fit by answering these questions:

QUESTION 1: Does this user have DEEP, PROVABLE domain expertise that this job requires?

Job requires domain expertise in: ${jobDescription.substring(0, 300)}...

User's experience:
${parsedResume.experiences?.map((exp: any) => `- ${exp.title} at ${exp.company} (${exp.date_start} - ${exp.date_end || 'present'})`).join('\n')}

Analysis:
- What SPECIFIC domain does this job require? (e.g., clinical/healthcare, legal, finance, B2B enterprise, etc.)
- Does the user have CLEAR, DETAILED experience in that exact domain?
- If they have 1 vague role in that domain, can you tell what they actually built and for whom?
- If you can't tell what they built, their experience is TOO VAGUE → RED WARNING

QUESTION 2: Would you need to add DOMAIN-SPECIFIC gap bullets to make them look qualified?

Think about gap bullets you considered adding:
- Did you want to add "shadowed [domain experts]"? → Domain-specific
- Did you want to add "navigated [domain regulations]"? → Domain-specific
- Did you want to add "worked with [domain stakeholders]"? → Domain-specific
- Did you want to add "understood [domain workflows]"? → Domain-specific

If YES to any → They lack domain expertise → RED WARNING

QUESTION 3: Is their STRONGEST, most detailed experience in a COMPLETELY DIFFERENT domain?

- What is their most impressive, well-described role with specific metrics and outcomes?
- What domain/industry/user type was that role in?
- Is that domain fundamentally different from what this job requires?
- Different user base? (consumers vs. professionals, patients vs. clinicians, etc.)
- Different problem space? (entertainment vs. clinical, consumer vs. enterprise, etc.)

If their best work is in a different domain → RED WARNING

QUESTION 4: Is this role asking for domain expertise they DON'T have?

Examples of domain-specific requirements:
- Clinical knowledge, medical workflows, healthcare regulatory → Requires healthcare experience
- Legal research, law firm workflows, case management → Requires legal industry experience
- Financial regulations, compliance, trading systems → Requires fintech/finance experience
- Enterprise sales cycles, procurement, security reviews → Requires B2B enterprise experience
- Manufacturing, supply chain, logistics → Requires operations/industrial experience

If job requires specialized domain knowledge AND user lacks it → RED WARNING

═══════════════════════════════════════════════════════════════════
FIT DECISION TREE (FOLLOW THIS EXACTLY)
═══════════════════════════════════════════════════════════════════

STEP 1: Does user have CLEAR, DETAILED experience in the exact domain required by job?
├─ YES → No warning needed (fit_warning: null) - skip remaining steps
└─ NO → Go to Step 2

STEP 2: Is user's experience ADJACENT or COMPLETELY DIFFERENT?

ADJACENT = Same general field but different segment
Examples:
- B2C SaaS → B2B SaaS (same: SaaS/product, different: customer type)
- Consumer AI → Enterprise AI (same: AI product, different: market segment)
- Startup advisor → IC Product Manager (same: product domain, different: execution level)
- Digital health → Clinical AI (same: health tech, different: clinical depth)
- SMB software → Enterprise software (same: software, different: scale/complexity)

COMPLETELY DIFFERENT = Different domain entirely with no overlap
Examples:
- Retail operations → Clinical healthcare (no overlap)
- Consumer SaaS → Government procurement (no overlap)
- B2C growth → Pharmaceutical R&D (no overlap)
- Teaching → Software engineering (no overlap)

├─ ADJACENT → Go to Step 3 (likely YELLOW)
└─ COMPLETELY DIFFERENT → RED WARNING (go to Step 5)

STEP 3: Can user's adjacent experience transfer with some positioning?
Ask: Do they have 50%+ of core requirements even if not exact domain match?

Examples of transferable:
- B2C PM → Enterprise PM: Has PM fundamentals (roadmap, metrics, shipping), lacks enterprise-specific (admin, procurement)
- Consumer growth → B2B growth: Has funnel optimization, lacks sales cycle understanding
- Mid-market SaaS → Enterprise SaaS: Has SaaS fundamentals, lacks enterprise scale/compliance

├─ YES (can transfer) → Go to Step 3a
└─ NO (too many gaps) → RED WARNING (go to Step 5)

STEP 3a: How strong is the match for adjacent experience?
Ask: Do they have 85%+ of requirements (high keyword match, strong core skills)?

HIGH MATCH (85%+ requirements, adjacent domain):
- User has nearly all requirements
- Domain gap is minor/adjacent (B2C → B2B, consumer → enterprise)
- Missing requirements are "preferred" or "nice to have", not hard requirements
- Core role fundamentals are very strong
→ NO WARNING NEEDED (fit_warning: null) - they're clearly qualified despite minor domain adjacency

MODERATE MATCH (50-85% requirements, adjacent domain):
- User has most requirements but some notable gaps
- Domain gap is meaningful but transferable
- Would benefit from addressing gaps in cover letter
→ YELLOW WARNING (go to Step 4)

LOW MATCH (<50% requirements):
→ RED WARNING (go to Step 5)

Example: B2C AI SaaS PM applying to B2B AI SaaS PM role
- Has: 90%+ keyword match, AI product experience, PM fundamentals, SaaS metrics, 0-to-1 launches
- Missing: Direct B2B sales cycle experience (but has B2B exposure via VC work)
- Job says "preferably B2B SaaS" (not required)
→ Decision: NO WARNING - High match (>85%), minor domain adjacency, strong core skills

STEP 4: YELLOW WARNING FORMAT
{
  "fit_warning": {
    "level": "yellow",
    "reasons": [
      "Your experience is in [their domain], this role requires [job domain]",
      "Key gap: [specific missing experience]",
      "Transferable: [what they DO have that's relevant]"
    ],
    "hard_questions": [
      "Can you explain how [their experience] prepares you for [job requirement]?",
      "Why are you interested in transitioning from [their domain] to [job domain]?"
    ],
    "suggestions": [
      "Emphasize transferable skills: [list them]",
      "In your cover letter, explain your interest in [domain transition]",
      "Be prepared to discuss how you'll close the knowledge gap"
    ]
  }
}

STEP 5: RED WARNING FORMAT
{
  "fit_warning": {
    "level": "red",
    "reasons": [
      "Specific, honest assessments of why this is a poor fit"
    ],
    "hard_questions": [
      "Questions they must answer before applying"
    ],
    "recommendation": "Direct advice on whether to apply",
    "alternative_suggestion": "What roles would fit their actual experience"
  }
}

═══════════════════════════════════════════════════════════════════
EXAMPLES OF YELLOW vs RED DECISIONS
═══════════════════════════════════════════════════════════════════

Example 1a: B2C AI SaaS PM → B2B AI SaaS PM (HIGH keyword match scenario)
Domain: ADJACENT (both AI SaaS, different customer type)
Has: 90%+ keyword match, AI product experience, PM fundamentals, SaaS metrics, 0-to-1 launches, some B2B exposure
Missing: Direct B2B sales rep experience (but job says "preferably B2B", not required)
Decision: NO WARNING
Reason: High match (>85%), minor adjacent domain gap, job doesn't hard-require B2B experience

Example 1b: B2C SaaS PM → Enterprise B2B SaaS PM (MODERATE match scenario)
Domain: ADJACENT (both SaaS, different customer type)
Has: PM fundamentals, SaaS metrics, product launches, growth
Missing: Enterprise sales cycles, procurement, admin features, compliance (job hard-requires enterprise experience)
Match: ~60% of requirements
Decision: YELLOW WARNING
Reason: Moderate match, meaningful enterprise-specific gaps that need addressing

Example 2: Consumer AI PM → Clinical AI PM (no healthcare background)
Domain: ADJACENT (both AI product, different vertical)
BUT: Clinical requires deep domain expertise (regulations, workflows, clinical knowledge)
Has: AI product fundamentals
Missing: Healthcare domain knowledge, clinical workflows, regulatory experience
Decision: RED WARNING if zero healthcare experience
Decision: YELLOW WARNING if has some health tech exposure
Reason: Clinical domain requires deep expertise, not just product skills

Example 3: Product Manager → VP Product
Domain: SAME (product management)
Gap: Seniority/scope
Decision: YELLOW WARNING
Reason: Same domain, different level - transferable with stretch

Example 4: Retail Operations → Clinical Decision Support PM
Domain: COMPLETELY DIFFERENT (no overlap)
Decision: RED WARNING
Reason: Zero overlap between retail ops and clinical AI products

Example 5a: B2C Growth PM with some B2B advisory → B2B Sales AI PM (HIGH match)
Domain: ADJACENT (PM fundamentals, some B2B exposure, different customer type)
Has: 85%+ keyword match, AI product experience, PM fundamentals, growth mindset, product launches, B2B advisory exposure
Missing: Direct sales rep experience (but job says "preferably B2B", not hard required)
Decision: NO WARNING
Reason: High match (>85%), strong AI + PM fundamentals, B2B is preferred not required, clearly qualified

Example 5b: B2C Growth PM with NO B2B exposure → Enterprise Compliance PM (MODERATE match)
Domain: ADJACENT (PM fundamentals, different market focus)
Has: PM fundamentals, growth mindset, product launches
Missing: Enterprise PM work, admin controls, compliance features, B2B experience
Match: ~55% of requirements
Decision: YELLOW WARNING
Reason: Moderate match, meaningful enterprise-specific gaps that need addressing in application

═══════════════════════════════════════════════════════════════════

NOW: Complete your fit assessment, then tailor the resume and include the fit_warning in your JSON response.

Remember:
- A RED warning that prevents a bad application is MORE VALUABLE than a tailored resume
- Your job is to help them apply to roles where they can SUCCEED, not just any role
- Be brutally honest about fit - they'll thank you later

Authenticity + Specificity + Strategic Positioning + HONEST FIT ASSESSMENT = Interviews
`

	const response = await openai.chat.completions.create({
		model: 'gpt-4.1',
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		],
		response_format: { type: 'json_object' },
		temperature: 0.7,
		max_tokens: 4096,
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