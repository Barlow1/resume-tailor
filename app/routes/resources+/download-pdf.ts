import { type LoaderFunctionArgs } from '@remix-run/node';
import { prisma as db } from '~/utils/db.server.ts';
import { getPdfFromHtml } from '~/utils/pdf.server.ts';
import type { OpenAIResumeData } from '~/utils/openai-resume-parser.server.ts';
import type { TailoredResume } from '~/utils/resume-tailor.server.ts';
import { getUserId, getStripeSubscription } from '~/utils/auth.server.ts';
import { trackResumeDownloaded, identifyUser } from '~/lib/analytics.server.ts';
import { trackUserActivity } from '~/lib/retention.server.ts';

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

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// Generate resume HTML with .resume wrapper so Puppeteer page-break logic works
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
	if (personalInfo.location) contactParts.push(escapeHtml(personalInfo.location));
	if (personalInfo.phone) contactParts.push(escapeHtml(personalInfo.phone));
	if (personalInfo.email) contactParts.push(escapeHtml(personalInfo.email));
	if (personalInfo.linkedin) contactParts.push('LinkedIn');
	const contactLine = contactParts.join(' | ');

	const experienceItems = originalResume.experiences.map((exp: any) => {
		const bullets = exp.bullet_points || [];
		const enhancedBullets = bullets.map((bullet: string) =>
			enhancedMap.get(bullet.trim()) || bullet
		);

		return `
		<div data-experience-id="${escapeHtml(exp.id || '')}">
			<div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 10pt; margin-bottom: 4pt;">
				<span style="font-weight: bold; font-size: 12pt;">${escapeHtml(exp.company)}</span>
				<span style="font-size: 12pt; white-space: nowrap;">${formatResumeDate(exp.date_start, exp.date_start_precision)} – ${formatResumeDate(exp.date_end, exp.date_end_precision)}</span>
			</div>
			<div style="font-style: italic; font-size: 11pt; margin-bottom: 4pt;">${escapeHtml(exp.title)}${exp.location ? ` | ${escapeHtml(exp.location)}` : ''}</div>
			<ul style="margin: 4pt 0 0 0; padding-left: 20pt; list-style-type: disc;">
				${enhancedBullets.map((bullet: string) => `<li style="font-size: 11pt; margin-bottom: 2pt; line-height: 1.15;">${escapeHtml(bullet)}</li>`).join('')}
			</ul>
		</div>
		`;
	}).join('');

	const educationItems = (originalResume.education || []).map((edu: any) => `
		<div data-education-id="${escapeHtml(edu.id || '')}" style="margin-bottom: 7pt;">
			<div style="display: flex; justify-content: space-between; align-items: baseline;">
				<span style="font-weight: bold; font-size: 11pt;">${escapeHtml(edu.degree)}${edu.major ? ` in ${escapeHtml(edu.major)}` : ''}</span>
				<span style="font-size: 11pt; white-space: nowrap;">${formatResumeDate(edu.date_start, edu.date_start_precision)} – ${formatResumeDate(edu.date_end, edu.date_end_precision)}</span>
			</div>
			<div style="font-size: 11pt;">${escapeHtml(edu.school)}${edu.gpa ? ` | GPA: ${escapeHtml(edu.gpa)}` : ''}</div>
		</div>
	`).join('');

	const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body { background: white; }
	</style>
</head>
<body>
	<div class="resume" style="font-family: Georgia, serif; font-size: 11pt; line-height: 1.15; color: #000; padding: 48px; width: 816px; min-height: 1056px; box-sizing: border-box; background: white;">
		<div style="text-align: center; margin-bottom: 14pt;">
			<div style="font-size: 20pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 7pt;">${escapeHtml(personalInfo.full_name.toUpperCase())}</div>
			<div style="font-size: 10pt; margin-bottom: 14pt;">${contactLine}</div>
		</div>

		${summary ? `
		<div data-section-id="summary">
			<div style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #000; margin-top: 14pt; margin-bottom: 7pt; padding-bottom: 1pt;">SUMMARY</div>
			<div style="font-size: 11pt; margin-bottom: 14pt; line-height: 1.15;">${escapeHtml(summary)}</div>
		</div>
		` : ''}

		<div data-section-id="experience">
			<div style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #000; margin-top: 14pt; margin-bottom: 7pt; padding-bottom: 1pt;">PROFESSIONAL EXPERIENCE</div>
			${experienceItems}
		</div>

		${educationItems ? `
		<div data-section-id="education">
			<div style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #000; margin-top: 14pt; margin-bottom: 7pt; padding-bottom: 1pt;">EDUCATION</div>
			${educationItems}
		</div>
		` : ''}

		${originalResume.skills && originalResume.skills.length > 0 ? `
		<div data-section-id="skills">
			<div style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #000; margin-top: 14pt; margin-bottom: 7pt; padding-bottom: 1pt;">SKILLS</div>
			<div style="font-size: 11pt; line-height: 1.15;">${escapeHtml(originalResume.skills.join(', '))}</div>
		</div>
		` : ''}
	</div>
</body>
</html>
	`;

	return html;
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const id = url.searchParams.get('id');

	if (!id) {
		throw new Response('Missing ID', { status: 400 });
	}

	// Check user subscription and download limit
	const userId = await getUserId(request);
	let subscription: Awaited<ReturnType<typeof getStripeSubscription>> = null;

	if (userId) {
		const [sub, gettingStartedProgress] = await Promise.all([
			getStripeSubscription(userId),
			db.gettingStartedProgress.findUnique({
				where: { ownerId: userId },
			}),
		]);
		subscription = sub;

		// If no subscription, check download limit (2 free downloads)
		if (!subscription) {
			const quickTailorDownloads = gettingStartedProgress?.quickTailorDownloadCount ?? 0;

			if (quickTailorDownloads >= 2) {
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

	const originalResume = JSON.parse(record.originalResume) as OpenAIResumeData;
	const tailored = JSON.parse(record.tailoredResume) as TailoredResume;

	try {
		// Generate HTML with .resume wrapper + data-section-id attributes
		const html = generateResumeHTML(originalResume, tailored);

		// Use the same Puppeteer pipeline as the builder for consistent output
		const pdfBuffer = await getPdfFromHtml(html);

		// Increment quickTailorDownloadCount after successful generation
		if (userId) {
			const progress = await db.gettingStartedProgress.upsert({
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

			// Track PDF download in PostHog
			trackResumeDownloaded(
				userId,
				'pdf',
				id,
				!!subscription,
				progress.quickTailorDownloadCount,
				request,
			);

			// Update lifetime_downloads user property for retention analysis
			identifyUser(userId, {
				lifetime_downloads: progress.quickTailorDownloadCount,
				last_active_at: new Date().toISOString(),
				...(progress.quickTailorDownloadCount === 1 && { first_download_at: new Date().toISOString() }),
			});

			// Track return visit if applicable
			await trackUserActivity({ userId, trigger: 'resume_download', request });
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
		throw new Response('Failed to generate PDF. Please try downloading DOCX instead.', { status: 500 });
	}
}
