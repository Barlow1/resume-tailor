import { OpenAI } from 'openai'
import { type User } from '@prisma/client'
import { invariant } from './misc.ts'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { type ResumeData } from './builder-resume.server.ts'
import { type  Metric } from './outreach-helpers.server.ts'
import { JobFit } from './ai-helpers.server.ts'

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
		model: 'gpt-4.1-mini',
		messages,
		temperature: 0.4,
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
		model: 'gpt-4.1-mini',
		messages,
		temperature: 0.4,
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
		model: 'gpt-4.1-mini',
		messages,
		temperature: 0.4,
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

					summary: a short overview (1–3 sentences) of the candidate’s profile; may be null if insufficient data.

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
							- Parse the job description for responsibilities/requirements (bullets, “Responsibilities”, “What you’ll do”, “Requirements”, “Qualifications”).
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
							- Do not include levels or parentheticals (e.g., “Advanced Excel” → “Excel”). Deduplicate both lists.

							Highlights
							- Provide 4–6 concise, resume-specific positives (impact, scope, leadership, outcomes, awards).
							- Each highlight must include a short label, a one-sentence detail, and a single supporting evidence snippet (with IDs if available).

							Metrics
							- Extract up to 5 quantified, resume-sourced results (e.g., “Reduced latency 45%”, “Owned $2M budget”).
							- For each metric, set:
							• statement: a compact, human-readable claim.
							• metric: the primary measure (e.g., “latency”, “revenue”, “users”, “cost”, “uptime”).
							• value: the numeric/quantified value as written (e.g., “45%”, “$2M”, “+120k”).
							• evidence: a resume snippet (and IDs if available).
							- Do not fabricate numbers.

							Summary
							- 1–2 sentences summarizing the candidate’s fit for the specific role (may mention seniority, core strengths, and overall alignment). Keep neutral and evidence-based.

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
							- match_score: integer 0–100 per “Scoring”.
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
					Start with a friendly greeting using their name. Then a sentence on who the user is. Think about problems the recruiter/hiring manager is likely facing that the role will solve. Then with a role-relevant line (DO NOT reuse the opening sentence) that ties a quantified win to likely priorities/problems, and do not fabricate a hook. Make value concrete with numbers and avoid buzzwords (no “passionate,” “innovative,” “synergy”). Keep one idea per sentence, short lines, zero fluff. Mirror likely priorities from the role/JD—delivery, risk, speed, alignment. Do not invent facts; use only the inputs given. Tone is confident, kind, and succinct. Use language like 'I'd love to chat' and other appreciative and human language.
					Channel limits: Email is ≤110 words with three short paragraphs plus a one-line CTA. LinkedIn DM is ≤700 characters in one paragraph. Connection note is ≤300 characters with no links. Follow-up is ≤70 words, references the original value with a fresh micro-proof, and offers an easy opt-out.
					Deliverables: Email with three subject options (≤7 words each, benefit-first) and a 110–120 word body that includes one proof link only if provided. LinkedIn DM that starts strong and ties win → role priority → CTA. LinkedIn Connection Note that’s personal but concise with a soft CTA. A polite follow-up if there’s no reply in 4–5 days. Make the tone of all text warm like a ${jobTitle}.`,
				},
				{
					role: 'user' as const,
					content: `Context

					Role I’m after: ${jobTitle}. My 1–2 signature wins (numbers, %): ${winsInline.join("; ") || "(none provided)"}. Why I’m a fit (skills/domain): ${fitInline.join(", ") || "(none provided)"}. The recruiter's name is ${recruiterName}. JD context (do not quote; do not invent): ${jobDescription ? jobDescription : ""}.
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