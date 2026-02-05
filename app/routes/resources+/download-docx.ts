import { type LoaderFunctionArgs } from '@remix-run/node';
import { prisma as db } from '~/utils/db.server.ts';
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, convertInchesToTwip, TabStopType } from 'docx';
import type { OpenAIResumeData } from '~/utils/openai-resume-parser.server.ts';
import type { TailoredResume } from '~/utils/resume-tailor.server.ts';
import { getUserId, getStripeSubscription } from '~/utils/auth.server.ts';
import { trackResumeDownloaded } from '~/lib/analytics.server.ts';

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

	// Header - Name (20pt, bold, uppercase, centered)
	children.push(
		new Paragraph({
			children: [
				new TextRun({
					text: personalInfo.full_name.toUpperCase(),
					bold: true,
					size: 40, // 20pt
					font: 'Georgia',
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 140 }, // 7pt
		})
	);

	// Contact info (10pt, centered)
	children.push(
		new Paragraph({
			children: [
				new TextRun({
					text: contactLine,
					size: 20, // 10pt
					font: 'Georgia',
				})
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 280 }, // 14pt
		})
	);

	// Summary section (12pt bold section title with border)
	if (summary) {
		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'SUMMARY',
						bold: true,
						size: 24, // 12pt
						font: 'Georgia',
					})
				],
				spacing: { before: 280, after: 140 }, // 14pt before, 7pt after
				border: {
					bottom: {
						color: '000000',
						space: 1,
						style: BorderStyle.SINGLE,
						size: 6,
					},
				},
			})
		);
		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: summary,
						size: 22, // 11pt
						font: 'Georgia',
					})
				],
				spacing: { after: 280, line: 276 }, // 14pt after, 1.15 line height
			})
		);
	}

	// Professional Experience (12pt bold section title with border)
	children.push(
		new Paragraph({
			children: [
				new TextRun({
					text: 'PROFESSIONAL EXPERIENCE',
					bold: true,
					size: 24, // 12pt
					font: 'Georgia',
				})
			],
			spacing: { before: 280, after: 140 }, // 14pt before, 7pt after
			border: {
				bottom: {
					color: '000000',
					space: 1,
					style: BorderStyle.SINGLE,
					size: 6,
				},
			},
		})
	);

	originalResume.experiences.forEach((exp: any, expIndex: number) => {
		const bullets = exp.bullet_points || [];
		const enhancedBullets = bullets.map((bullet: string) =>
			enhancedMap.get(bullet.trim()) || bullet
		);

		// Get suggested bullets for this experience
		const suggestedBullets = tailored.suggested_bullets?.filter((sb: any) =>
			sb.section === `experiences[${expIndex}]`
		) || [];

		// Company and dates (12pt, bold company, dates right-aligned)
		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: exp.company,
						bold: true,
						size: 24, // 12pt
						font: 'Georgia',
					}),
					new TextRun({
						text: `\t${formatResumeDate(exp.date_start, exp.date_start_precision)} – ${formatResumeDate(exp.date_end, exp.date_end_precision)}`,
						size: 24, // 12pt
						font: 'Georgia',
					}),
				],
				spacing: { before: 200, after: 80 }, // 10pt before, 4pt after
				tabStops: [
					{
						type: TabStopType.RIGHT,
						position: 10800, // Right align at content edge (7.5 inches = 10800 twips)
					}
				],
			})
		);

		// Title and location (11pt, italic)
		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: exp.title,
						italics: true,
						size: 22, // 11pt
						font: 'Georgia',
					}),
					...(exp.location ? [new TextRun({ text: ` | ${exp.location}`, size: 22, font: 'Georgia' })] : []),
				],
				spacing: { after: 80 }, // 4pt after
			})
		);

		// Bullet points (11pt)
		enhancedBullets.forEach((bullet: string) => {
			children.push(
				new Paragraph({
					children: [
						new TextRun({
							text: bullet,
							size: 22, // 11pt
							font: 'Georgia',
						})
					],
					bullet: { level: 0 },
					spacing: { after: 40, line: 276 }, // 2pt after, 1.15 line height
				})
			);
		});

		// Add suggested bullets for this experience (highlighted in yellow, italic)
		if (suggestedBullets.length > 0) {
			suggestedBullets.forEach((item: any) => {
				children.push(
					new Paragraph({
						children: [
							new TextRun({
								text: item.bullet,
								size: 22, // 11pt
								font: 'Georgia',
								italics: true,
								highlight: 'yellow',
							})
						],
						bullet: { level: 0 },
						spacing: { after: 40, line: 276 }, // 2pt after, 1.15 line height
					})
				);
			});
		}
	});

	// Education (12pt bold section title with border)
	if (originalResume.education && originalResume.education.length > 0) {
		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'EDUCATION',
						bold: true,
						size: 24, // 12pt
						font: 'Georgia',
					})
				],
				spacing: { before: 280, after: 140 }, // 14pt before, 7pt after
				border: {
					bottom: {
						color: '000000',
						space: 1,
						style: BorderStyle.SINGLE,
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
							size: 22, // 11pt
							font: 'Georgia',
						}),
						new TextRun({
							text: `\t${formatResumeDate(edu.date_start, edu.date_start_precision)} – ${formatResumeDate(edu.date_end, edu.date_end_precision)}`,
							size: 22, // 11pt
							font: 'Georgia',
						}),
					],
					spacing: { before: 200, after: 60 }, // 10pt before, 3pt after
					tabStops: [
						{
							type: TabStopType.RIGHT,
							position: 10800, // Right align at content edge (7.5 inches = 10800 twips)
						}
					],
				})
			);

			children.push(
				new Paragraph({
					children: [
						new TextRun({
							text: `${edu.school}${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}`,
							size: 22, // 11pt
							font: 'Georgia',
						})
					],
					spacing: { after: 140 }, // 7pt after
				})
			);
		});
	}

	// Skills (12pt bold section title with border)
	if (originalResume.skills && originalResume.skills.length > 0) {
		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: 'SKILLS',
						bold: true,
						size: 24, // 12pt
						font: 'Georgia',
					})
				],
				spacing: { before: 280, after: 140 }, // 14pt before, 7pt after
				border: {
					bottom: {
						color: '000000',
						space: 1,
						style: BorderStyle.SINGLE,
						size: 6,
					},
				},
			})
		);

		children.push(
			new Paragraph({
				children: [
					new TextRun({
						text: originalResume.skills.join(', '),
						size: 22, // 11pt
						font: 'Georgia',
					})
				],
				spacing: { after: 200, line: 276 }, // 10pt after, 1.15 line height
			})
		);
	}

	return new Document({
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: convertInchesToTwip(0.5),
							right: convertInchesToTwip(0.5),
							bottom: convertInchesToTwip(0.5),
							left: convertInchesToTwip(0.5),
						},
					},
				},
				children: children,
			},
		],
	});
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
		// Generate DOCX
		const doc = generateResumeDocx(originalResume, tailored);

		// Convert to buffer
		const buffer = await Packer.toBuffer(doc);

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

			// Track DOCX download in PostHog
			trackResumeDownloaded(
				userId,
				'docx',
				id,
				!!subscription,
				progress.quickTailorDownloadCount,
				request,
			);
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
		throw new Response('Failed to generate DOCX', { status: 500 });
	}
}
