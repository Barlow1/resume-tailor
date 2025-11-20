import { type LoaderFunctionArgs } from '@remix-run/node';
import { prisma as db } from '~/utils/db.server';
import htmlPdf from 'html-pdf-node';
import fs from 'fs';
import path from 'path';
import type { OpenAIResumeData } from '~/utils/openai-resume-parser.server';
import type { TailoredResume } from '~/utils/resume-tailor.server';
import { getUserId, getStripeSubscription } from '~/utils/auth.server';

// Helper function to format dates for resume display
function formatResumeDate(isoDate: string | null, precision?: 'day' | 'month' | 'year'): string {
	if (!isoDate) return 'Present';

	const date = new Date(isoDate);
	const month = date.toLocaleDateString('en-US', { month: 'short' });
	const year = date.getFullYear();

	if (precision === 'year') {
		return `${year}`;
	} else if (precision === 'month') {
		return `${month} ${year}`;
	} else {
		return `${month} ${year}`;
	}
}

// Generate resume HTML matching DOCX styling exactly
function generateResumeHTML(originalResume: OpenAIResumeData, tailored: TailoredResume): string {
	const personalInfo = originalResume.personal_info;
	const summary = tailored.enhanced_summary?.enhanced || originalResume.summary || '';

	// Use enhanced bullets
	const enhancedMap = new Map<string, string>();
	tailored.enhanced_bullets?.forEach((eb: any) => {
		enhancedMap.set(eb.original.trim(), eb.enhanced);
	});

	// Build contact line
	const contactParts = [];
	if (personalInfo.location) contactParts.push(personalInfo.location);
	if (personalInfo.phone) contactParts.push(personalInfo.phone);
	if (personalInfo.email) contactParts.push(personalInfo.email);
	if (personalInfo.linkedin) contactParts.push('LinkedIn');
	const contactLine = contactParts.join(' | ');

	let html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<style>
		@page {
			margin: 0.75in;
		}
		body {
			font-family: Georgia, serif;
			font-size: 11pt;
			line-height: 1.15;
			color: #000;
			margin: 0;
			padding: 0;
		}
		.header {
			text-align: center;
			margin-bottom: 14pt;
		}
		.name {
			font-family: Georgia, serif;
			font-size: 20pt;
			font-weight: bold;
			text-transform: uppercase;
			letter-spacing: 0.5pt;
			margin-bottom: 7pt;
		}
		.contact {
			font-family: Georgia, serif;
			font-size: 10pt;
			margin-bottom: 14pt;
		}
		.section-title {
			font-family: Georgia, serif;
			font-size: 12pt;
			font-weight: bold;
			border-bottom: 1px solid #000;
			margin-top: 14pt;
			margin-bottom: 7pt;
			padding-bottom: 1pt;
		}
		.job-header {
			margin-top: 10pt;
			margin-bottom: 4pt;
		}
		.company {
			font-family: Georgia, serif;
			font-size: 12pt;
			font-weight: bold;
			display: inline;
		}
		.dates {
			font-family: Georgia, serif;
			font-size: 12pt;
			float: right;
		}
		.title {
			font-family: Georgia, serif;
			font-size: 11pt;
			font-style: italic;
			margin-bottom: 4pt;
			clear: both;
		}
		ul {
			margin: 4pt 0 0 0;
			padding-left: 20pt;
			list-style-type: disc;
		}
		li {
			font-family: Georgia, serif;
			font-size: 11pt;
			margin-bottom: 2pt;
			line-height: 1.15;
		}
		.summary-text {
			font-family: Georgia, serif;
			font-size: 11pt;
			margin-bottom: 14pt;
			line-height: 1.15;
		}
		.education-item {
			margin-bottom: 7pt;
		}
		.degree {
			font-family: Georgia, serif;
			font-size: 11pt;
			font-weight: bold;
		}
		.school {
			font-family: Georgia, serif;
			font-size: 11pt;
		}
		.skills-text {
			font-family: Georgia, serif;
			font-size: 11pt;
			line-height: 1.15;
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="name">${personalInfo.full_name.toUpperCase()}</div>
		<div class="contact">${contactLine}</div>
	</div>

	${summary ? `
	<div class="section-title">SUMMARY</div>
	<div class="summary-text">${summary}</div>
	` : ''}

	<div class="section-title">PROFESSIONAL EXPERIENCE</div>
	${originalResume.experiences.map((exp: any) => {
		const bullets = exp.bullet_points || [];
		const enhancedBullets = bullets.map((bullet: string) =>
			enhancedMap.get(bullet.trim()) || bullet
		);

		return `
		<div class="job-header">
			<span class="company">${exp.company}</span>
			<span class="dates">${formatResumeDate(exp.date_start, exp.date_start_precision)} – ${formatResumeDate(exp.date_end, exp.date_end_precision)}</span>
		</div>
		<div class="title">${exp.title}${exp.location ? ` | ${exp.location}` : ''}</div>
		<ul>
			${enhancedBullets.map((bullet: string) => `<li>${bullet}</li>`).join('')}
		</ul>
		`;
	}).join('')}

	${originalResume.education && originalResume.education.length > 0 ? `
	<div class="section-title">EDUCATION</div>
	${originalResume.education.map((edu: any) => `
		<div class="education-item">
			<div>
				<span class="degree">${edu.degree}${edu.major ? ` in ${edu.major}` : ''}</span>
				<span class="dates" style="float: right;">${formatResumeDate(edu.date_start, edu.date_start_precision)} – ${formatResumeDate(edu.date_end, edu.date_end_precision)}</span>
			</div>
			<div class="school" style="clear: both;">${edu.school}${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}</div>
		</div>
	`).join('')}
	` : ''}

	${originalResume.skills && originalResume.skills.length > 0 ? `
	<div class="section-title">SKILLS</div>
	<div class="skills-text">${originalResume.skills.join(', ')}</div>
	` : ''}
</body>
</html>
	`;

	return html;
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const id = url.searchParams.get('id');

	console.log('📄 DOWNLOAD PDF: Request for', id);

	if (!id) {
		throw new Response('Missing ID', { status: 400 });
	}

	// Check user subscription and download limit
	const userId = await getUserId(request);

	if (userId) {
		const [subscription, gettingStartedProgress] = await Promise.all([
			getStripeSubscription(userId),
			db.gettingStartedProgress.findUnique({
				where: { ownerId: userId },
			}),
		]);

		// If no subscription, check download limit (1 free download)
		if (!subscription) {
			const quickTailorDownloads = gettingStartedProgress?.quickTailorDownloadCount ?? 0;

			if (quickTailorDownloads >= 1) {
				throw new Response('Download limit reached. Please subscribe to continue.', { status: 403 });
			}
		}
	}

	const record = await db.tailoredResume.findUnique({
		where: { id },
	});

	if (!record) {
		throw new Response('Not found', { status: 404 });
	}

	const originalResume: OpenAIResumeData = JSON.parse(record.originalResume);
	const tailored: TailoredResume = JSON.parse(record.tailoredResume);

	console.log(
		'📄 DOWNLOAD PDF: Generating for:',
		originalResume.personal_info.full_name,
	);

	try {
		// Generate HTML
		const html = generateResumeHTML(originalResume, tailored);

		console.log('📄 DOWNLOAD PDF: HTML generated, converting to PDF...');

		// Convert HTML to PDF
		const options = {
			format: 'Letter',
			margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
		};

		const file = { content: html };
		const pdfBuffer = await htmlPdf.generatePdf(file, options);

		console.log('✅ DOWNLOAD PDF: Converted to PDF, size:', pdfBuffer.length, 'bytes');

		// Increment quickTailorDownloadCount after successful generation
		if (userId) {
			await db.gettingStartedProgress.upsert({
				where: { ownerId: userId },
				update: { quickTailorDownloadCount: { increment: 1 } },
				create: {
					ownerId: userId,
					quickTailorDownloadCount: 1,
					hasSavedJob: false,
					hasSavedResume: false,
					hasTailoredResume: false,
					hasGeneratedResume: false,
					tailorCount: 0,
					generateCount: 0,
					downloadCount: 0,
					analysisCount: 0,
					outreachCount: 0,
				},
			});
		}

		const filename = `${originalResume.personal_info.full_name.replace(/\s+/g, '_')}_Resume.pdf`;

		return new Response(pdfBuffer, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': pdfBuffer.length.toString(),
			},
		});
	} catch (error) {
		console.error('❌ DOWNLOAD PDF: Error:', error);
		throw new Response('Failed to generate PDF. Please try downloading DOCX instead.', { status: 500 });
	}
}
