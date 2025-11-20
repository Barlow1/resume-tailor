import { type LoaderFunctionArgs } from '@remix-run/node';
import { prisma as db } from '~/utils/db.server.ts';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import type { OpenAIResumeData } from '~/utils/openai-resume-parser.server.ts';
import type { TailoredResume } from '~/utils/resume-tailor.server.ts';
import { getUserId, getStripeSubscription } from '~/utils/auth.server.ts';

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

// Generate resume DOCX
function generateResumeDocx(originalResume: OpenAIResumeData, tailored: TailoredResume): Document {
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

	const children: Paragraph[] = [];

	// Header - Name
	children.push(
		new Paragraph({
			text: personalInfo.full_name.toUpperCase(),
			heading: HeadingLevel.TITLE,
			alignment: AlignmentType.CENTER,
			spacing: { after: 100 },
		})
	);

	// Contact info
	children.push(
		new Paragraph({
			text: contactLine,
			alignment: AlignmentType.CENTER,
			spacing: { after: 200 },
		})
	);

	// Summary section
	if (summary) {
		children.push(
			new Paragraph({
				text: 'SUMMARY',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 100 },
				border: {
					bottom: {
						color: '000000',
						space: 1,
						style: 'single',
						size: 6,
					},
				},
			})
		);
		children.push(
			new Paragraph({
				text: summary,
				spacing: { after: 200 },
			})
		);
	}

	// Professional Experience
	children.push(
		new Paragraph({
			text: 'PROFESSIONAL EXPERIENCE',
			heading: HeadingLevel.HEADING_1,
			spacing: { before: 200, after: 100 },
			border: {
				bottom: {
					color: '000000',
					space: 1,
					style: 'single',
					size: 6,
				},
			},
		})
	);

	originalResume.experiences.forEach((exp: any) => {
		const bullets = exp.bullet_points || [];
		const enhancedBullets = bullets.map((bullet: string) =>
			enhancedMap.get(bullet.trim()) || bullet
		);

		// Company and dates
		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: exp.company,
						bold: true,
						size: 24,
					}),
					new TextRun({
						text: `\t${formatResumeDate(exp.date_start, exp.date_start_precision)} – ${formatResumeDate(exp.date_end, exp.date_end_precision)}`,
						size: 24,
					}),
				],
				spacing: { before: 150, after: 50 },
			})
		);

		// Title and location
		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: exp.title,
						italics: true,
						size: 22,
					}),
					...(exp.location ? [new TextRun({ text: ` | ${exp.location}`, size: 22 })] : []),
				],
				spacing: { after: 50 },
			})
		);

		// Bullet points
		enhancedBullets.forEach((bullet: string) => {
			children.push(
				new Paragraph({
					text: bullet,
					bullet: { level: 0 },
					spacing: { after: 30 },
				})
			);
		});
	});

	// Education
	if (originalResume.education && originalResume.education.length > 0) {
		children.push(
			new Paragraph({
				text: 'EDUCATION',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 100 },
				border: {
					bottom: {
						color: '000000',
						space: 1,
						style: 'single',
						size: 6,
					},
				},
			})
		);

		originalResume.education.forEach((edu: any) => {
			children.push(
				new Paragraph({
					children: [
						new TextRun({
							text: `${edu.degree}${edu.major ? ` in ${edu.major}` : ''}`,
							bold: true,
							size: 22,
						}),
						new TextRun({
							text: `\t${formatResumeDate(edu.date_start, edu.date_start_precision)} – ${formatResumeDate(edu.date_end, edu.date_end_precision)}`,
							size: 22,
						}),
					],
					spacing: { before: 100, after: 30 },
				})
			);

			children.push(
				new Paragraph({
					text: `${edu.school}${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}`,
					spacing: { after: 100 },
				})
			);
		});
	}

	// Skills
	if (originalResume.skills && originalResume.skills.length > 0) {
		children.push(
			new Paragraph({
				text: 'SKILLS',
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 100 },
				border: {
					bottom: {
						color: '000000',
						space: 1,
						style: 'single',
						size: 6,
					},
				},
			})
		);

		children.push(
			new Paragraph({
				text: originalResume.skills.join(', '),
				spacing: { after: 100 },
			})
		);
	}

	return new Document({
		sections: [
			{
				properties: {},
				children: children,
			},
		],
	});
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const id = url.searchParams.get('id');

	console.log('📄 DOWNLOAD DOCX: Request for', id);

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

	const originalResume = JSON.parse(record.originalResume) as OpenAIResumeData;
	const tailored = JSON.parse(record.tailoredResume) as TailoredResume;

	console.log(
		'📄 DOWNLOAD DOCX: Generating for:',
		originalResume.personal_info.full_name,
	);

	try {
		// Generate DOCX
		const doc = generateResumeDocx(originalResume, tailored);

		console.log('📄 DOWNLOAD DOCX: Document generated, converting to buffer...');

		// Convert to buffer
		const buffer = await Packer.toBuffer(doc);

		console.log('✅ DOWNLOAD DOCX: Converted to buffer, size:', buffer.length, 'bytes');

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

		const filename = `${originalResume.personal_info.full_name.replace(/\s+/g, '_')}_Resume.docx`;

		return new Response(buffer, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': buffer.length.toString(),
			},
		});
	} catch (error) {
		console.error('❌ DOWNLOAD DOCX: Error:', error);
		throw new Response('Failed to generate DOCX', { status: 500 });
	}
}
