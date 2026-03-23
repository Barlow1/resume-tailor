/**
 * End-to-end pipeline demo: Parse resume → Match 3 JDs → User answers → Bullet generation
 *
 * Usage: npx tsx scripts/preview-full-pipeline.ts
 *
 * Requires OPENAI_API_KEY in .env
 */

import 'dotenv/config'
import { readFile } from 'fs/promises'
import path from 'path'
import pdf from 'pdf-parse-fork'
import { parseResumeWithOpenAI, type OpenAIResumeData } from '../app/utils/openai-resume-parser.server.ts'
import { getExperienceMatch } from '../app/utils/openai.server.ts'
import { generateRequirementBullets } from '../app/utils/openai.server.ts'
import { buildResumeSummary, type ExperienceMatch } from '../app/utils/ai/experience-match.server.ts'
import type { ResumeData } from '../app/utils/builder-resume.server.ts'

// ═══════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════

const RESUME_FILE = 'Brayan_Londono_Resume_Bamboo.pdf'

// Three real JDs: strong fit, moderate fit, weak fit
const JOB_DESCRIPTIONS: { label: string; fitExpectation: string; content: string }[] = [
	{
		label: 'JD #1 — STRONG FIT',
		fitExpectation: 'Strong',
		content: `Senior Product Manager — Digital Health Platform
Company: Olive AI (Remote)

About the Role:
We're looking for a Senior Product Manager to lead our digital health platform products. You'll work cross-functionally with engineering, design, and clinical teams to build products that transform healthcare operations.

Requirements:
- 4+ years of product management experience in healthcare technology
- Experience with EHR/EMR systems, claims processing, or healthcare data pipelines
- Strong background in AI/ML product features (e.g., automation, NLP, predictive analytics)
- Experience managing 0-to-1 products from concept through launch
- Familiarity with Agile/Scrum methodologies and sprint planning
- Excellent cross-functional collaboration with engineering and design teams
- Data-driven decision making with experience in A/B testing and product analytics
- Strong written and verbal communication skills for PRDs, specs, and stakeholder presentations
- Experience with healthcare compliance (HIPAA) and data privacy requirements
- Bachelor's degree in a relevant field

Nice to Have:
- Experience with revenue cycle management or medical billing
- Familiarity with EDI standards (837, 835, 270/271)
- Experience building developer tools or APIs
- Background in startup environments`,
	},
	{
		label: 'JD #2 — MODERATE FIT',
		fitExpectation: 'Moderate',
		content: `Product Manager, Enterprise SaaS — Supply Chain Analytics
Company: Kinaxis (Ottawa, ON — Hybrid)

About the Role:
Join our product team to drive the next generation of supply chain planning and analytics tools. You'll own the roadmap for our enterprise analytics module, working with Fortune 500 customers to solve complex supply chain challenges.

Requirements:
- 5+ years of product management experience in B2B/enterprise SaaS
- Deep understanding of supply chain management, demand planning, or inventory optimization
- Experience working with Fortune 500 or large enterprise customers
- Proven track record of driving product adoption and revenue growth
- Strong SQL skills and experience with data visualization tools (Tableau, Looker, Power BI)
- Experience with enterprise integration patterns (APIs, webhooks, batch processing)
- Ability to translate complex technical concepts for non-technical stakeholders
- Experience with Agile development practices
- Understanding of machine learning applications in business contexts
- MBA or equivalent experience preferred

Nice to Have:
- APICS/CSCP certification
- Experience with SAP, Oracle, or other ERP systems
- Background in consulting or professional services
- Experience with multi-tenant SaaS architecture`,
	},
	{
		label: 'JD #3 — WEAK FIT',
		fitExpectation: 'Weak',
		content: `Senior iOS Engineer
Company: Robinhood (Menlo Park, CA — In-Office)

About the Role:
We're looking for a Senior iOS Engineer to join our mobile trading team. You'll build and maintain our flagship iOS app used by millions of investors, working on real-time market data, order execution, and portfolio management features.

Requirements:
- 5+ years of professional iOS development experience
- Expert-level Swift and Objective-C proficiency
- Deep understanding of UIKit, SwiftUI, and iOS SDK frameworks
- Experience with real-time data streaming (WebSockets, gRPC)
- Strong understanding of financial markets and trading systems
- Experience with performance optimization for mobile apps (memory, battery, network)
- Familiarity with CI/CD pipelines for mobile (Fastlane, Xcode Cloud)
- Experience with unit testing, UI testing, and test automation (XCTest, Quick/Nimble)
- Understanding of secure coding practices and data encryption
- Experience shipping apps to millions of users on the App Store
- Bachelor's or Master's in Computer Science or equivalent

Nice to Have:
- Experience with real-time charting libraries
- Knowledge of FIX protocol or market data feeds
- Contributions to open-source iOS libraries
- Experience with accessibility (VoiceOver, Dynamic Type)`,
	},
]

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function hr(char = '=', len = 70) {
	return char.repeat(len)
}

function section(title: string) {
	console.log(`\n${hr()}`)
	console.log(`  ${title}`)
	console.log(hr())
}

function subsection(title: string) {
	console.log(`\n  ${hr('-', 60)}`)
	console.log(`  ${title}`)
	console.log(`  ${hr('-', 60)}`)
}

/** Convert parsed OpenAI resume data to the ResumeData shape used by the pipeline */
function toResumeData(parsed: OpenAIResumeData): ResumeData {
	let expCounter = 0
	let descCounter = 0

	return {
		name: parsed.personal_info.full_name,
		role: parsed.experiences?.[0]?.title ?? null,
		email: parsed.personal_info.email,
		phone: parsed.personal_info.phone,
		location: parsed.personal_info.location,
		about: parsed.summary ?? null,
		experiences: parsed.experiences.map(exp => ({
			id: `exp-${++expCounter}`,
			role: exp.title,
			company: exp.company,
			startDate: exp.date_start,
			endDate: exp.date_end,
			descriptions: exp.bullet_points.map(bp => ({
				id: `desc-${++descCounter}`,
				content: bp,
				order: descCounter,
			})),
		})),
		education: parsed.education.map((ed, i) => ({
			id: `edu-${i + 1}`,
			school: ed.school,
			degree: `${ed.degree}${ed.major ? ` in ${ed.major}` : ''}`,
			startDate: ed.date_start,
			endDate: ed.date_end,
			description: null,
		})),
		skills: parsed.skills.map((s, i) => ({
			id: `skill-${i + 1}`,
			name: s,
		})),
		visibleSections: null,
	}
}

function printMatchResult(match: ExperienceMatch) {
	console.log(`\n  Match Level: ${match.level.toUpperCase()}`)
	console.log(`  One-liner: ${match.oneLineSummary}`)
	console.log(`  Coverage: ${match.requirementsCovered}/${match.requirementsTotal}`)
	console.log(`\n  Full Summary:\n    ${match.summary}`)

	if (match.coveredRequirements.length > 0) {
		console.log(`\n  Already on resume (${match.coveredRequirements.length}):`)
		match.coveredRequirements.forEach(r => console.log(`    [covered] ${r}`))
	}

	if (match.missingRequirements.length > 0) {
		console.log(`\n  Missing / needs evidence (${match.missingRequirements.length}):`)
		match.missingRequirements.forEach(r => console.log(`    [missing] ${r}`))
	}

	if (match.skipSuggestion) {
		console.log(`\n  Skip suggestion: "${match.skipSuggestion}"`)
	}

	console.log(`\n  Best Moves:`)
	match.bestMoves.forEach((m, i) => {
		console.log(`    ${i + 1}. [${m.type}] ${m.headline}`)
		console.log(`       ${m.explanation}`)
		if (m.targetRequirements?.length) {
			console.log(`       Targets: ${m.targetRequirements.join(', ')}`)
		}
		if (m.evidenceNote) {
			console.log(`       Evidence: ${m.evidenceNote}`)
		}
	})
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function run() {
	// --- STEP 1: Parse Resume ---
	section('STEP 1: PARSE RESUME')
	console.log(`  File: ${RESUME_FILE}`)

	const buffer = await readFile(path.resolve('tests', 'fixtures', RESUME_FILE))

	// Create a File-like object for Node (no native File in older Node versions)
	const blob = {
		name: RESUME_FILE,
		type: 'application/pdf',
		size: buffer.length,
		lastModified: Date.now(),
		arrayBuffer: () => Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)),
		text: () => Promise.resolve(''),
		slice: () => new Blob(),
		stream: () => new ReadableStream(),
	} as unknown as File

	console.log('  Sending to OpenAI for parsing...')
	const parsed = await parseResumeWithOpenAI(blob)

	console.log(`\n  Name: ${parsed.personal_info.full_name}`)
	console.log(`  Email: ${parsed.personal_info.email}`)
	console.log(`  Phone: ${parsed.personal_info.phone}`)
	console.log(`  Location: ${parsed.personal_info.location}`)
	if (parsed.personal_info.linkedin) console.log(`  LinkedIn: ${parsed.personal_info.linkedin}`)
	if (parsed.personal_info.portfolio) console.log(`  Portfolio: ${parsed.personal_info.portfolio}`)
	if (parsed.personal_info.github) console.log(`  GitHub: ${parsed.personal_info.github}`)

	console.log(`\n  SUMMARY:`)
	console.log(`    ${parsed.summary ?? '(none)'}`)

	console.log(`\n  EXPERIENCES (${parsed.experiences.length}):`)
	parsed.experiences.forEach((exp, i) => {
		console.log(`\n    [${i + 1}] ${exp.title} at ${exp.company}`)
		console.log(`        ${exp.date_start ?? '?'} - ${exp.date_end ?? 'Present'}${exp.location ? ` | ${exp.location}` : ''}`)
		if (exp.description) console.log(`        Description: ${exp.description}`)
		exp.bullet_points.forEach((bp, j) => {
			console.log(`        ${j + 1}. ${bp}`)
		})
		if (exp.skills.length > 0) console.log(`        Skills: ${exp.skills.join(', ')}`)
	})

	console.log(`\n  EDUCATION (${parsed.education.length}):`)
	parsed.education.forEach(ed => {
		console.log(`    ${ed.degree} in ${ed.major}${ed.minor ? ` (minor: ${ed.minor})` : ''} @ ${ed.school}`)
		console.log(`    ${ed.date_start ?? '?'} - ${ed.date_end ?? '?'}${ed.location ? ` | ${ed.location}` : ''}`)
		if (ed.gpa) console.log(`    GPA: ${ed.gpa}`)
		if (ed.honors?.length) console.log(`    Honors: ${ed.honors.join(', ')}`)
		if (ed.relevant_coursework?.length) console.log(`    Coursework: ${ed.relevant_coursework.join(', ')}`)
	})

	console.log(`\n  SKILLS (${parsed.skills.length}):`)
	parsed.skills.forEach(s => console.log(`    - ${s}`))

	if (parsed.skills_extracted?.length) {
		console.log(`\n  SKILLS EXTRACTED FROM BULLETS (${parsed.skills_extracted.length}):`)
		parsed.skills_extracted.forEach(s => console.log(`    - ${s}`))
	}

	if (parsed.certifications?.length) {
		console.log(`\n  CERTIFICATIONS:`)
		parsed.certifications.forEach(c => console.log(`    - ${c.name} (${c.issuer}${c.date ? `, ${c.date}` : ''})`))
	}

	if (parsed.projects?.length) {
		console.log(`\n  PROJECTS:`)
		parsed.projects.forEach(p => {
			console.log(`    - ${p.name}: ${p.description}`)
			if (p.technologies.length) console.log(`      Tech: ${p.technologies.join(', ')}`)
		})
	}

	if (parsed.volunteer?.length) {
		console.log(`\n  VOLUNTEER:`)
		parsed.volunteer.forEach(v => console.log(`    - ${v.role} at ${v.organization}: ${v.description}`))
	}

	// Also print what the pipeline sees (the buildResumeSummary text)
	const resumeData = toResumeData(parsed)
	console.log(`\n  --- RESUME AS THE AI SEES IT (buildResumeSummary) ---`)
	console.log(buildResumeSummary(resumeData).split('\n').map(l => `    ${l}`).join('\n'))

	// --- STEP 2 + 3 + 4: For each JD, match -> simulate user -> generate bullets ---
	const matchResults: { label: string; match: ExperienceMatch }[] = []

	for (const jd of JOB_DESCRIPTIONS) {
		section(`STEP 2: EXPERIENCE MATCH -- ${jd.label}`)
		console.log(`  Expected fit: ${jd.fitExpectation}`)
		console.log('  Analyzing...')

		const match = await getExperienceMatch({
			resumeData,
			jobDescription: jd.content,
		})

		printMatchResult(match)
		matchResults.push({ label: jd.label, match })

		// --- STEP 3: Simulate User ---
		subsection(`STEP 3: USER SIMULATION for ${jd.label}`)

		if (match.missingRequirements.length === 0) {
			console.log('  No missing requirements -- nothing to answer!')
			continue
		}

		// Simulate yes/no based on fit level
		let yesCount: number
		if (match.level === 'strong') {
			yesCount = Math.max(1, Math.ceil(match.missingRequirements.length * 0.8))
		} else if (match.level === 'moderate') {
			yesCount = Math.max(1, Math.ceil(match.missingRequirements.length * 0.5))
		} else {
			yesCount = Math.min(2, match.missingRequirements.length)
		}

		const yesRequirements = match.missingRequirements.slice(0, yesCount)
		const noRequirements = match.missingRequirements.slice(yesCount)

		// Assign each "yes" to first experience (most recent)
		const requirementExperienceMap: Record<string, string> = {}
		yesRequirements.forEach(req => {
			requirementExperienceMap[req] = resumeData.experiences?.[0]?.id ?? 'exp-1'
		})

		console.log(`\n  Missing requirements: ${match.missingRequirements.length}`)
		console.log(`  User says YES to ${yesCount}:`)
		yesRequirements.forEach(r => {
			const assignedExp = resumeData.experiences?.find(e => e.id === requirementExperienceMap[r])
			console.log(`    [YES] "${r}" -> assigned to: ${assignedExp?.role} at ${assignedExp?.company}`)
		})
		console.log(`  User says NO to ${noRequirements.length}:`)
		noRequirements.forEach(r => console.log(`    [NO]  "${r}"`))

		// --- STEP 4: Generate Bullets ---
		if (yesRequirements.length > 0) {
			subsection(`STEP 4: AI BULLET GENERATION for ${jd.label}`)
			console.log('  Generating bullets...')

			const result = await generateRequirementBullets({
				resumeData,
				jobDescription: jd.content,
				requirements: yesRequirements,
				requirementExperienceMap,
			})

			if (result.summary) {
				console.log(`\n  NEW SUMMARY (F-shaped scanline):`)
				console.log(`    "${result.summary}"`)
				console.log(`\n  OLD SUMMARY:`)
				console.log(`    "${resumeData.about}"`)
			}

			if (result.warnings?.length) {
				console.log(`\n  WARNINGS:`)
				result.warnings.forEach(w => console.log(`    WARNING: ${w}`))
			}

			// --- Per-bullet detail ---
			console.log(`\n  BULLET-BY-BULLET DECISIONS (${result.bullets.length}):`)
			for (const bullet of result.bullets) {
				const icon = bullet.action === 'not_a_bullet' ? 'NOT A BULLET' : bullet.action === 'already_covered' ? 'COVERED' : bullet.action === 'rewrite' ? 'REWRITE' : bullet.isGap ? 'GAP' : 'NEW'
				console.log(`\n    [${icon}] Requirement: "${bullet.requirement}"`)
				if (bullet.experienceName) {
					console.log(`      Under: ${bullet.experienceName}`)
				}
				if (bullet.action === 'rewrite') {
					console.log(`      BEFORE: "${bullet.originalText}"`)
					console.log(`      AFTER:  "${bullet.bulletText}"`)
				} else if (bullet.action === 'new') {
					if (bullet.isGap) {
						console.log(`      -> GENUINE GAP -- no plausible experience to attribute this to`)
					} else {
						console.log(`      ADDED:  "${bullet.bulletText}"`)
					}
				} else if (bullet.action === 'already_covered') {
					console.log(`      EXISTING BULLET: "${bullet.originalText}"`)
					console.log(`      -> Already demonstrates this requirement. No changes needed.`)
				} else if (bullet.action === 'not_a_bullet') {
					console.log(`      -> ${(bullet as any).explanation ?? 'This requirement is shown through your timeline, not a bullet.'}`)
				}
			}

			const rewrites = result.bullets.filter(b => b.action === 'rewrite').length
			const newBullets = result.bullets.filter(b => b.action === 'new' && !b.isGap).length
			const covered = result.bullets.filter(b => b.action === 'already_covered').length
			const notABullet = result.bullets.filter(b => b.action === 'not_a_bullet').length
			const gaps = result.bullets.filter(b => b.isGap).length

			console.log(`\n  STATS: ${rewrites} rewrites, ${newBullets} new, ${covered} already covered, ${notABullet} not-a-bullet, ${gaps} gaps`)

			// --- FULL BEFORE/AFTER of each affected experience ---
			const affectedExpIds = new Set(result.bullets.filter(b => b.experienceId).map(b => b.experienceId!))
			if (affectedExpIds.size > 0) {
				subsection(`BEFORE/AFTER VIEW -- What the resume looks like after changes (${jd.label})`)

				// Show summary change
				console.log(`\n  SUMMARY:`)
				console.log(`    BEFORE: "${resumeData.about}"`)
				console.log(`    AFTER:  "${result.summary ?? resumeData.about}"`)

				for (const expId of affectedExpIds) {
					const exp = resumeData.experiences?.find(e => e.id === expId)
					if (!exp) continue

					const bulletsForExp = result.bullets.filter(b => b.experienceId === expId)
					const rewriteMap = new Map(bulletsForExp.filter(b => b.action === 'rewrite' && b.existingBulletId).map(b => [b.existingBulletId!, b.bulletText!]))
					const newBulletsForExp = bulletsForExp.filter(b => b.action === 'new' && !b.isGap && b.bulletText)

					console.log(`\n  ${exp.role} at ${exp.company}`)
					console.log(`  ${exp.startDate ?? '?'} - ${exp.endDate ?? 'Present'}`)
					console.log(`  ${'~'.repeat(50)}`)

					// BEFORE
					console.log(`\n    BEFORE (${exp.descriptions?.length ?? 0} bullets):`)
					exp.descriptions?.forEach((d, i) => {
						const wasRewritten = rewriteMap.has(d.id ?? '')
						const marker = wasRewritten ? ' [WILL BE REWRITTEN]' : ''
						console.log(`      ${i + 1}. ${d.content}${marker}`)
					})

					// AFTER
					const afterBullets: string[] = []
					exp.descriptions?.forEach(d => {
						if (rewriteMap.has(d.id ?? '')) {
							afterBullets.push(rewriteMap.get(d.id ?? '')!)
						} else {
							afterBullets.push(d.content ?? '')
						}
					})
					// Append new bullets
					newBulletsForExp.forEach(b => afterBullets.push(b.bulletText!))

					console.log(`\n    AFTER (${afterBullets.length} bullets):`)
					afterBullets.forEach((text, i) => {
						// Mark which ones changed
						const isNew = i >= (exp.descriptions?.length ?? 0)
						const isRewritten = !isNew && text !== exp.descriptions?.[i]?.content
						const tag = isNew ? ' [NEW]' : isRewritten ? ' [REWRITTEN]' : ''
						console.log(`      ${i + 1}. ${text}${tag}`)
					})
				}
			}
		}
	}

	// --- FINAL SUMMARY ---
	section('PIPELINE COMPLETE -- SUMMARY')
	for (const { label, match } of matchResults) {
		console.log(`  ${label}: ${match.level.toUpperCase()} (${match.requirementsCovered}/${match.requirementsTotal}) -- ${match.oneLineSummary}`)
	}
	console.log()
}

run().catch(err => {
	console.error('Pipeline failed:', err)
	process.exit(1)
})
