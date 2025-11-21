import OpenAI from 'openai';
import type { OpenAIResumeData } from './openai-resume-parser.server.ts';
import { getPromptVersion, ACTIVE_PROMPT } from '~/prompts/tailor-prompts.ts';
import fs from 'fs';
import path from 'path';

export interface TailoredResume {
	enhanced_bullets: Array<{
		section: string;
		original: string;
		enhanced: string;
		changes: string;
		added_keywords: string[];
	}>;
	suggested_bullets: Array<{
		section: string;
		bullet: string;
		evidence: string;
		confidence: 'high' | 'medium' | 'low';
		placeholders: string[];
	}>;
	gaps: Array<{
		category:
			| 'technical_skill'
			| 'domain'
			| 'tool'
			| 'certification'
			| 'experience_level';
		missing: string;
		required_by_jd: string;
		severity: 'critical' | 'moderate' | 'minor';
		reasoning: string;
		suggestion: string;
	}>;
	enhanced_summary?: {
		original: string;
		enhanced: string;
		changes: string;
	};
}

export async function tailorResume({
	resume,
	jobDescription,
	promptVersion,
	additionalContext,
}: {
	resume: OpenAIResumeData;
	jobDescription: string;
	promptVersion?: string;
	additionalContext?: string;
}): Promise<TailoredResume> {
	const startTime = Date.now();
	const version = promptVersion || ACTIVE_PROMPT.version;

	const openai = new OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
	});

	const systemPrompt = getPromptVersion(version);
	const userMessage = buildUserMessage(
		resume,
		jobDescription,
		additionalContext,
	);

	// Save request to file in debug mode
	if (
		process.env.DEBUG_MODE === 'true' ||
		process.env.SAVE_AI_RESPONSES === 'true'
	) {
		const debugDir = path.join(process.cwd(), 'debug-logs');
		if (!fs.existsSync(debugDir)) {
			fs.mkdirSync(debugDir, { recursive: true });
		}

		const timestamp = new Date().toISOString().replace(/:/g, '-');
		const requestFile = path.join(
			debugDir,
			`tailor-request-${timestamp}.json`,
		);

		fs.writeFileSync(
			requestFile,
			JSON.stringify(
				{
					timestamp: new Date().toISOString(),
					model: 'gpt-4.1',
					promptVersion: version,
					jobDescriptionLength: jobDescription.length,
					resumeExperiences: resume.experiences?.length || 0,
					resumeName: resume.personal_info?.full_name,
					systemPrompt,
					userMessage,
				},
				null,
				2,
			),
		);
	}

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4.1',
			temperature: 0.4,
			response_format: { type: 'json_object' },
			messages: [
				{
					role: 'system',
					content: systemPrompt,
				},
				{
					role: 'user',
					content: userMessage,
				},
			],
		});

		const elapsed = Date.now() - startTime;

		const content = response.choices[0].message.content;
		if (!content) {
			throw new Error('No content in OpenAI response');
		}

		// Save response to file in debug mode
		if (
			process.env.DEBUG_MODE === 'true' ||
			process.env.SAVE_AI_RESPONSES === 'true'
		) {
			const debugDir = path.join(process.cwd(), 'debug-logs');
			const timestamp = new Date().toISOString().replace(/:/g, '-');
			const responseFile = path.join(
				debugDir,
				`tailor-response-${timestamp}.json`,
			);

			fs.writeFileSync(
				responseFile,
				JSON.stringify(
					{
						timestamp: new Date().toISOString(),
						model: 'gpt-4.1',
						promptVersion: version,
						latency: elapsed,
						usage: response.usage,
						rawResponse: content,
					},
					null,
					2,
				),
			);
		}

		const parsed = JSON.parse(content) as TailoredResume;

		return parsed as TailoredResume;
	} catch (error) {
		throw error;
	}
}

function buildUserMessage(
	resume: OpenAIResumeData,
	jobDescription: string,
	additionalContext?: string,
): string {
	let message = `JOB DESCRIPTION:\n\n${jobDescription}\n\n---\n\nRESUME TO TAILOR:\n\n`;

	// Personal info
	message += `${resume.personal_info.full_name}\n`;
	message += `${resume.personal_info.email}`;
	if (resume.personal_info.phone) message += ` | ${resume.personal_info.phone}`;
	if (resume.personal_info.location)
		message += ` | ${resume.personal_info.location}`;
	message += `\n`;
	if (resume.personal_info.linkedin)
		message += `LinkedIn: ${resume.personal_info.linkedin}\n`;
	if (resume.personal_info.github)
		message += `GitHub: ${resume.personal_info.github}\n`;
	if (resume.personal_info.portfolio)
		message += `Portfolio: ${resume.personal_info.portfolio}\n`;
	message += `\n`;

	// Summary
	if (resume.summary) {
		message += `PROFESSIONAL SUMMARY:\n${resume.summary}\n\n`;
	}

	// Experience
	message += `PROFESSIONAL EXPERIENCE:\n\n`;
	resume.experiences?.forEach((exp, idx) => {
		message += `[experiences[${idx}]]\n`;
		message += `${exp.title} | ${exp.company}\n`;
		message += `${exp.date_start} - ${exp.date_end || 'Present'}`;
		if (exp.location) message += ` | ${exp.location}`;
		message += `\n`;

		if (exp.description) {
			message += `${exp.description}\n`;
		}

		exp.bullet_points?.forEach(bullet => {
			message += `• ${bullet}\n`;
		});
		message += `\n`;
	});

	// Education
	if (resume.education?.length > 0) {
		message += `EDUCATION:\n\n`;
		resume.education.forEach(edu => {
			message += `${edu.degree}`;
			if (edu.major) message += ` in ${edu.major}`;
			message += ` | ${edu.school}\n`;
			if (edu.gpa) message += `GPA: ${edu.gpa}\n`;
			if (edu.honors?.length)
				message += `Honors: ${edu.honors.join(', ')}\n`;
			if (edu.relevant_coursework?.length) {
				message += `Relevant Coursework: ${edu.relevant_coursework.join(', ')}\n`;
			}
			message += `\n`;
		});
	}

	// Skills
	if (resume.skills?.length > 0) {
		message += `SKILLS:\n${resume.skills.join(', ')}\n\n`;
	}

	// Certifications
	if (resume.certifications && resume.certifications.length > 0) {
		message += `CERTIFICATIONS:\n`;
		resume.certifications.forEach(cert => {
			message += `• ${cert.name} - ${cert.issuer}`;
			if (cert.date) message += ` (${cert.date})`;
			message += `\n`;
		});
		message += `\n`;
	}

	// Projects
	if (resume.projects && resume.projects.length > 0) {
		message += `PROJECTS:\n`;
		resume.projects.forEach(proj => {
			message += `• ${proj.name}: ${proj.description}\n`;
			if (proj.technologies?.length) {
				message += `  Technologies: ${proj.technologies.join(', ')}\n`;
			}
			if (proj.link) {
				message += `  Link: ${proj.link}\n`;
			}
		});
		message += `\n`;
	}

	// Additional context from user
	if (additionalContext) {
		message += `---\n\nADDITIONAL CONTEXT FROM USER:\n\n${additionalContext}\n\n`;
		message += `The user has provided additional information about their experience. Use this to inform your suggestions. If they mention experience not visible in the resume, you can suggest bullets based on this context.\n\n`;
	}

	message += `---\n\nNow tailor this resume for the job description above. Remember: honesty over optimization.`;

	return message;
}

export async function retailorWithContext({
	originalResume,
	jobDescription,
	additionalContext,
	promptVersion,
}: {
	originalResume: OpenAIResumeData;
	jobDescription: string;
	additionalContext: string;
	promptVersion?: string;
}): Promise<TailoredResume> {
	return tailorResume({
		resume: originalResume,
		jobDescription,
		promptVersion,
		additionalContext,
	});
}
