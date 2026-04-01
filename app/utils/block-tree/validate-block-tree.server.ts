/**
 * Validates an AI-generated BlockTree against raw OOXML source data.
 *
 * Zod validates structure; this validates CONTENT — that the AI's claims
 * match reality. Catches hallucinated content, wrong font sizes, missing
 * sections, and phantom fonts.
 *
 * Returns a confidence score (0-1) and a list of issues.
 * Threshold: >= 0.7 to trust the AI result.
 */

import type { BlockTree, Block, ExperienceContent, InlineSegment } from './types'

export interface ValidationResult {
	confidence: number
	issues: string[]
}

/**
 * Extract all visible text from document.xml (content of w:t elements).
 */
function extractDocumentText(documentXml: string): string {
	const texts: string[] = []
	const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g
	let match
	while ((match = regex.exec(documentXml)) !== null) {
		texts.push(match[1])
	}
	return texts.join(' ')
}

/**
 * Extract font names from fontTable.xml and styles.xml.
 */
function extractSourceFonts(
	fontTableXml: string,
	stylesXml?: string,
): Set<string> {
	const fonts = new Set<string>()

	// fontTable.xml: <w:font w:name="Garamond">
	const fontTableRegex = /w:font\s+w:name="([^"]*)"/g
	let match
	while ((match = fontTableRegex.exec(fontTableXml)) !== null) {
		fonts.add(match[1])
	}

	// styles.xml: w:rFonts w:ascii="..."
	if (stylesXml) {
		const rFontsRegex = /w:rFonts[^>]*?w:ascii="([^"]*)"/g
		while ((match = rFontsRegex.exec(stylesXml)) !== null) {
			fonts.add(match[1])
		}
	}

	return fonts
}

/**
 * Count paragraphs that look like experience entry headers:
 * bold text followed (within a few paragraphs) by bulleted content.
 */
function countExperiencePatterns(documentXml: string): number {
	// Extract paragraphs with their properties
	const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g
	const paragraphs: { isBold: boolean; hasBullet: boolean; hasText: boolean }[] = []

	let match
	while ((match = paraRegex.exec(documentXml)) !== null) {
		const para = match[0]
		const isBold = /<w:b[\s/>]/.test(para) || /<w:b\s/.test(para)
		const hasBullet = /w:numPr/.test(para)
		const hasText = /<w:t[^>]*>[^<]+<\/w:t>/.test(para)
		paragraphs.push({ isBold, hasBullet, hasText })
	}

	// Count bold paragraphs that are followed by at least one bullet paragraph
	let count = 0
	for (let i = 0; i < paragraphs.length; i++) {
		if (paragraphs[i].isBold && paragraphs[i].hasText && !paragraphs[i].hasBullet) {
			// Look ahead for bullets within the next 10 paragraphs
			for (let j = i + 1; j < Math.min(i + 10, paragraphs.length); j++) {
				if (paragraphs[j].hasBullet) {
					count++
					break
				}
				// If we hit another bold non-bullet paragraph, this starts a new entry
				if (paragraphs[j].isBold && paragraphs[j].hasText && !paragraphs[j].hasBullet) {
					break
				}
			}
		}
	}

	return count
}

/**
 * Count paragraphs with bottom borders (section dividers).
 */
function countSectionDividers(documentXml: string): number {
	const regex = /<w:pBdr>[\s\S]*?<w:bottom[^>]*w:val="(?!none)[^"]*"/g
	const matches = documentXml.match(regex)
	return matches?.length ?? 0
}

/**
 * Extract the first w:sz value from the document (likely the name/header).
 */
function extractFirstFontSize(documentXml: string): number | null {
	// Find the first paragraph with text, then get its font size
	const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g
	let match
	while ((match = paraRegex.exec(documentXml)) !== null) {
		const para = match[0]
		// Must have visible text
		if (!/<w:t[^>]*>[^<]+<\/w:t>/.test(para)) continue

		// Look for w:sz in run properties
		const szMatch = para.match(/w:sz\s+w:val="(\d+)"/)
		if (szMatch) {
			return parseInt(szMatch[1], 10) / 2 // half-points to pt
		}
	}
	return null
}

/**
 * Get plain text from InlineSegment array.
 */
function segmentsToText(segments: InlineSegment[]): string {
	return segments.map(s => s.text).join('')
}

/**
 * Check 1: Name text exists in document (weight: 0.2)
 */
function checkNameExists(
	blockTree: BlockTree,
	docText: string,
): { score: number; issue?: string } {
	const headerBlock = blockTree.blocks.find(b => b.type === 'header')
	if (!headerBlock) return { score: 0, issue: 'No header block found' }

	const content = headerBlock.content as { name?: string }
	if (!content.name) return { score: 0, issue: 'Header block has no name' }

	const name = content.name.trim()
	if (docText.includes(name)) return { score: 1 }

	// Try partial match (first name or last name)
	const parts = name.split(/\s+/)
	const partialMatch = parts.some(p => p.length > 2 && docText.includes(p))
	if (partialMatch) {
		return { score: 0.5, issue: `Name "${name}" not found verbatim, but partial match exists` }
	}

	return { score: 0, issue: `Name "${name}" not found in document text` }
}

/**
 * Check 2: Font families exist in source (weight: 0.2)
 */
function checkFontsExist(
	blockTree: BlockTree,
	sourceFonts: Set<string>,
): { score: number; issue?: string } {
	// Collect all font families mentioned by AI
	const aiFonts = new Set<string>()
	if (blockTree.globalTokens.fontFamily) {
		aiFonts.add(blockTree.globalTokens.fontFamily)
	}
	for (const block of blockTree.blocks) {
		if (block.tokens.fontFamily) {
			aiFonts.add(block.tokens.fontFamily)
		}
	}

	if (aiFonts.size === 0) return { score: 1 } // No fonts claimed

	let found = 0
	const missing: string[] = []
	for (const font of aiFonts) {
		// Check if the font (or a close variant) exists in source
		const exists = Array.from(sourceFonts).some(
			sf => sf.toLowerCase() === font.toLowerCase() ||
				sf.toLowerCase().includes(font.toLowerCase()) ||
				font.toLowerCase().includes(sf.toLowerCase()),
		)
		if (exists) {
			found++
		} else {
			missing.push(font)
		}
	}

	const score = found / aiFonts.size
	const issue = missing.length > 0
		? `Fonts not found in source: ${missing.join(', ')}`
		: undefined
	return { score, issue }
}

/**
 * Check 3: Experience entry count (weight: 0.2)
 */
function checkExperienceCount(
	blockTree: BlockTree,
	documentXml: string,
): { score: number; issue?: string } {
	const expBlocks = blockTree.blocks.filter(b => b.type === 'experience')
	if (expBlocks.length === 0) return { score: 1 } // No experience blocks to check

	const aiEntryCount = expBlocks.reduce((sum, b) => {
		const content = b.content as ExperienceContent
		return sum + (content.entries?.length ?? 0)
	}, 0)

	const xmlEntryCount = countExperiencePatterns(documentXml)
	if (xmlEntryCount === 0) return { score: 1 } // Can't verify

	const diff = Math.abs(aiEntryCount - xmlEntryCount)
	if (diff === 0) return { score: 1 }
	if (diff === 1) {
		return {
			score: 0.5,
			issue: `Experience entries: AI found ${aiEntryCount}, XML suggests ~${xmlEntryCount}`,
		}
	}
	return {
		score: 0,
		issue: `Experience entries mismatch: AI found ${aiEntryCount}, XML suggests ~${xmlEntryCount}`,
	}
}

/**
 * Check 4: Section heading count (weight: 0.15)
 */
function checkSectionHeadingCount(
	blockTree: BlockTree,
	documentXml: string,
): { score: number; issue?: string } {
	const aiSectionCount = blockTree.blocks.filter(
		b => b.sectionHeader || b.decorations.some(d => d.type === 'horizontal-rule'),
	).length

	const xmlDividerCount = countSectionDividers(documentXml)
	if (xmlDividerCount === 0) return { score: 1 } // No dividers to check

	const diff = Math.abs(aiSectionCount - xmlDividerCount)
	if (diff <= 1) return { score: 1 }
	if (diff <= 2) {
		return {
			score: 0.5,
			issue: `Section count: AI found ${aiSectionCount} sections with headers/dividers, XML has ${xmlDividerCount} paragraph borders`,
		}
	}
	return {
		score: 0,
		issue: `Section count mismatch: AI found ${aiSectionCount}, XML has ${xmlDividerCount} dividers`,
	}
}

/**
 * Check 5: Font size spot-check on header/name (weight: 0.15)
 */
function checkFontSizeSpotCheck(
	blockTree: BlockTree,
	documentXml: string,
): { score: number; issue?: string } {
	const headerBlock = blockTree.blocks.find(b => b.type === 'header')
	if (!headerBlock) return { score: 1 }

	// Get the AI's claimed name font size from header tokens or block tokens
	const headerContent = headerBlock.content as { headerTokens?: { name?: { fontSize?: number } } }
	const aiNameSize =
		headerContent.headerTokens?.name?.fontSize ??
		headerBlock.tokens.fontSize

	if (!aiNameSize) return { score: 1 } // No size claimed

	const xmlFirstSize = extractFirstFontSize(documentXml)
	if (!xmlFirstSize) return { score: 1 } // Can't verify

	const diff = Math.abs(aiNameSize - xmlFirstSize)
	if (diff === 0) return { score: 1 }
	if (diff <= 1) return { score: 0.7 }
	return {
		score: 0,
		issue: `Name font size: AI claims ${aiNameSize}pt, XML first paragraph is ${xmlFirstSize}pt`,
	}
}

/**
 * Check 6: No phantom content — verify random bullet text exists (weight: 0.1)
 */
function checkNoPhantomContent(
	blockTree: BlockTree,
	docText: string,
): { score: number; issue?: string } {
	// Collect all bullet text from experience blocks
	const allBullets: string[] = []
	for (const block of blockTree.blocks) {
		if (block.type === 'experience') {
			const content = block.content as ExperienceContent
			for (const entry of content.entries ?? []) {
				for (const bullet of entry.bullets ?? []) {
					const text = segmentsToText(bullet)
					if (text.length > 10) allBullets.push(text)
				}
			}
		}
	}

	if (allBullets.length === 0) return { score: 1 }

	// Sample up to 3 bullets
	const sampled = allBullets.length <= 3
		? allBullets
		: [allBullets[0], allBullets[Math.floor(allBullets.length / 2)], allBullets[allBullets.length - 1]]

	let found = 0
	const missing: string[] = []
	for (const bullet of sampled) {
		// Check for a significant substring (first 30 chars) to allow minor formatting differences
		const checkText = bullet.slice(0, 30)
		if (docText.includes(checkText)) {
			found++
		} else {
			missing.push(checkText + '...')
		}
	}

	const score = found / sampled.length
	const issue = missing.length > 0
		? `Possible hallucinated content: ${missing.join('; ')}`
		: undefined
	return { score, issue }
}

// --- PDF Validation Types ---

interface PdfValidationLine {
	text: string
	x: number
	y: number
	fontFamily: string
	fontSize: number
	fontWeight: number
	color: string
}

interface PdfValidationData {
	pages: {
		lines: PdfValidationLine[]
		fonts: { family: string; weight: number; style: string }[]
	}[]
}

// --- PDF Validation Checks ---

/**
 * Check 1 (PDF): Name text exists in first 20% of page 1 lines (weight: 0.2)
 */
function checkPdfNameExists(
	blockTree: BlockTree,
	pdfData: PdfValidationData,
): { score: number; issue?: string } {
	const headerBlock = blockTree.blocks.find(b => b.type === 'header')
	if (!headerBlock) return { score: 0, issue: 'No header block found' }

	const content = headerBlock.content as { name?: string }
	if (!content.name) return { score: 0, issue: 'Header block has no name' }

	const name = content.name.trim()
	const page1Lines = pdfData.pages[0]?.lines ?? []
	const cutoff = Math.max(1, Math.ceil(page1Lines.length * 0.2))
	const topLines = page1Lines.slice(0, cutoff)
	const topText = topLines.map(l => l.text).join(' ')

	if (topText.includes(name)) return { score: 1 }

	const parts = name.split(/\s+/)
	const partialMatch = parts.some(p => p.length > 2 && topText.includes(p))
	if (partialMatch) {
		return { score: 0.5, issue: `Name "${name}" not found verbatim in top lines, but partial match exists` }
	}

	return { score: 0, issue: `Name "${name}" not found in first 20% of page 1 lines` }
}

/**
 * Check 2 (PDF): Font families exist in PDF font list (weight: 0.2)
 */
function checkPdfFontsExist(
	blockTree: BlockTree,
	pdfData: PdfValidationData,
): { score: number; issue?: string } {
	const aiFonts = new Set<string>()
	if (blockTree.globalTokens.fontFamily) {
		aiFonts.add(blockTree.globalTokens.fontFamily)
	}
	for (const block of blockTree.blocks) {
		if (block.tokens.fontFamily) {
			aiFonts.add(block.tokens.fontFamily)
		}
		// Check header element tokens
		if (block.type === 'header') {
			const content = block.content as { headerTokens?: { name?: { fontFamily?: string }; role?: { fontFamily?: string }; contact?: { fontFamily?: string } } }
			const ht = content.headerTokens
			if (ht?.name?.fontFamily) aiFonts.add(ht.name.fontFamily)
			if (ht?.role?.fontFamily) aiFonts.add(ht.role.fontFamily)
			if (ht?.contact?.fontFamily) aiFonts.add(ht.contact.fontFamily)
		}
	}

	if (aiFonts.size === 0) return { score: 1 }

	const pdfFonts = pdfData.pages.flatMap(p => p.fonts)
	let found = 0
	const missing: string[] = []
	for (const font of aiFonts) {
		const exists = pdfFonts.some(
			pf => pf.family.toLowerCase() === font.toLowerCase() ||
				pf.family.toLowerCase().includes(font.toLowerCase()) ||
				font.toLowerCase().includes(pf.family.toLowerCase()),
		)
		if (exists) {
			found++
		} else {
			missing.push(font)
		}
	}

	const score = found / aiFonts.size
	const issue = missing.length > 0
		? `Fonts not found in PDF: ${missing.join(', ')}`
		: undefined
	return { score, issue }
}

/**
 * Count "bold line followed by non-bold lines" patterns in a list of PDF lines.
 */
function countPdfExperiencePatterns(lines: PdfValidationLine[]): number {
	let count = 0
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].fontWeight >= 700 && lines[i].text.trim().length > 0) {
			// Look ahead for at least one non-bold line
			for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
				if (lines[j].fontWeight < 700 && lines[j].text.trim().length > 0) {
					count++
					break
				}
				// If we hit another bold line, stop looking ahead for this entry
				if (lines[j].fontWeight >= 700 && lines[j].text.trim().length > 0) {
					break
				}
			}
		}
	}
	return count
}

/**
 * Check 3 (PDF): Experience entry count (weight: 0.2)
 */
function checkPdfExperienceCount(
	blockTree: BlockTree,
	pdfData: PdfValidationData,
): { score: number; issue?: string } {
	const expBlocks = blockTree.blocks.filter(b => b.type === 'experience')
	if (expBlocks.length === 0) return { score: 1 }

	const aiEntryCount = expBlocks.reduce((sum, b) => {
		const content = b.content as ExperienceContent
		return sum + (content.entries?.length ?? 0)
	}, 0)

	const allLines = pdfData.pages.flatMap(p => p.lines)
	const pdfEntryCount = countPdfExperiencePatterns(allLines)
	if (pdfEntryCount === 0) return { score: 1 }

	// PDF heuristic overcounts because name, section headers, etc. also match bold→non-bold.
	// Be lenient: AI count should be <= heuristic count (AI is more precise).
	// Only flag if AI found significantly more than the heuristic (hallucination) or far fewer.
	const diff = Math.abs(aiEntryCount - pdfEntryCount)
	if (diff <= 2) return { score: 1 }
	if (diff <= 4) {
		return {
			score: 0.5,
			issue: `Experience entries: AI found ${aiEntryCount}, PDF suggests ~${pdfEntryCount}`,
		}
	}
	return {
		score: 0,
		issue: `Experience entries mismatch: AI found ${aiEntryCount}, PDF suggests ~${pdfEntryCount}`,
	}
}

/**
 * Count lines that look like section headers in PDF:
 * larger font, different color from body text, or ALL CAPS with reasonable length.
 */
function countPdfSectionHeaderPatterns(lines: PdfValidationLine[]): number {
	if (lines.length === 0) return 0

	// Determine median font size as the "body" size
	const sizes = lines.map(l => l.fontSize).sort((a, b) => a - b)
	const medianSize = sizes[Math.floor(sizes.length / 2)]

	// Determine most common color as "body" color
	const colorCounts: Record<string, number> = {}
	for (const line of lines) {
		colorCounts[line.color] = (colorCounts[line.color] ?? 0) + 1
	}
	const bodyColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

	let count = 0
	for (const line of lines) {
		const text = line.text.trim()
		if (text.length < 2 || text.length > 40) continue

		const isLargerFont = line.fontSize > medianSize + 1
		const isDifferentColor = bodyColor !== undefined && line.color !== bodyColor
		const isAllCaps = text === text.toUpperCase() && /[A-Z]/.test(text)

		if (isLargerFont || isDifferentColor || isAllCaps) {
			count++
		}
	}
	return count
}

/**
 * Check 4 (PDF): Section heading count (weight: 0.15)
 */
function checkPdfSectionHeadingCount(
	blockTree: BlockTree,
	pdfData: PdfValidationData,
): { score: number; issue?: string } {
	const aiSectionCount = blockTree.blocks.filter(b => b.sectionHeader).length

	const allLines = pdfData.pages.flatMap(p => p.lines)
	const pdfSectionCount = countPdfSectionHeaderPatterns(allLines)
	if (pdfSectionCount === 0) return { score: 1 }

	// PDF heuristic overcounts (name, role, contact line, etc. all match header patterns).
	// Be lenient: only flag large discrepancies.
	const diff = Math.abs(aiSectionCount - pdfSectionCount)
	if (diff <= 3) return { score: 1 }
	if (diff <= 5) {
		return {
			score: 0.5,
			issue: `Section count: AI found ${aiSectionCount} section headers, PDF suggests ~${pdfSectionCount}`,
		}
	}
	return {
		score: 0,
		issue: `Section count mismatch: AI found ${aiSectionCount}, PDF suggests ~${pdfSectionCount}`,
	}
}

/**
 * Check 5 (PDF): Font size spot-check on name (weight: 0.15)
 */
function checkPdfFontSizeSpotCheck(
	blockTree: BlockTree,
	pdfData: PdfValidationData,
): { score: number; issue?: string } {
	const headerBlock = blockTree.blocks.find(b => b.type === 'header')
	if (!headerBlock) return { score: 1 }

	const headerContent = headerBlock.content as { headerTokens?: { name?: { fontSize?: number } } }
	const aiNameSize =
		headerContent.headerTokens?.name?.fontSize ??
		headerBlock.tokens.fontSize

	if (!aiNameSize) return { score: 1 }

	const page1Lines = pdfData.pages[0]?.lines ?? []
	const first3Lines = page1Lines.slice(0, 3)
	if (first3Lines.length === 0) return { score: 1 }

	const largestSize = Math.max(...first3Lines.map(l => l.fontSize))

	const diff = Math.abs(aiNameSize - largestSize)
	if (diff === 0) return { score: 1 }
	if (diff <= 2) return { score: 0.7, issue: `Name font size: AI claims ${aiNameSize}pt, PDF first lines largest is ${largestSize}pt` }
	return {
		score: 0,
		issue: `Name font size: AI claims ${aiNameSize}pt, PDF first lines largest is ${largestSize}pt`,
	}
}

/**
 * Check 6 (PDF): Random bullet text check (weight: 0.1)
 */
function checkPdfNoPhantomContent(
	blockTree: BlockTree,
	pdfData: PdfValidationData,
): { score: number; issue?: string } {
	const allBullets: string[] = []
	for (const block of blockTree.blocks) {
		if (block.type === 'experience') {
			const content = block.content as ExperienceContent
			for (const entry of content.entries ?? []) {
				for (const bullet of entry.bullets ?? []) {
					const text = segmentsToText(bullet)
					if (text.length > 10) allBullets.push(text)
				}
			}
		}
	}

	if (allBullets.length === 0) return { score: 1 }

	const sampled = allBullets.length <= 3
		? allBullets
		: [allBullets[0], allBullets[Math.floor(allBullets.length / 2)], allBullets[allBullets.length - 1]]

	const allPageText = pdfData.pages.flatMap(p => p.lines.map(l => l.text)).join(' ')

	let found = 0
	const missing: string[] = []
	for (const bullet of sampled) {
		const checkText = bullet.slice(0, 30)
		if (allPageText.includes(checkText)) {
			found++
		} else {
			missing.push(checkText + '...')
		}
	}

	const score = found / sampled.length
	const issue = missing.length > 0
		? `Possible hallucinated content: ${missing.join('; ')}`
		: undefined
	return { score, issue }
}

/**
 * Validate an AI-generated BlockTree against raw PDF extraction data.
 *
 * Returns a weighted confidence score and a list of issues.
 * Confidence >= 0.7 means the AI result is trustworthy.
 */
export function validateBlockTreeForPdf(
	blockTree: BlockTree,
	pdfData: PdfValidationData,
): ValidationResult {
	const checks = [
		{ weight: 0.2, ...checkPdfNameExists(blockTree, pdfData) },
		{ weight: 0.2, ...checkPdfFontsExist(blockTree, pdfData) },
		{ weight: 0.2, ...checkPdfExperienceCount(blockTree, pdfData) },
		{ weight: 0.15, ...checkPdfSectionHeadingCount(blockTree, pdfData) },
		{ weight: 0.15, ...checkPdfFontSizeSpotCheck(blockTree, pdfData) },
		{ weight: 0.1, ...checkPdfNoPhantomContent(blockTree, pdfData) },
	]

	const confidence = checks.reduce(
		(sum, check) => sum + check.weight * check.score,
		0,
	)

	const issues = checks
		.filter(c => c.issue)
		.map(c => c.issue!)

	return { confidence, issues }
}

/**
 * Validate an AI-generated BlockTree against raw OOXML.
 *
 * Returns a weighted confidence score and a list of issues.
 * Confidence >= 0.7 means the AI result is trustworthy.
 */
export function validateBlockTree(
	blockTree: BlockTree,
	rawDocumentXml: string,
	rawFontTableXml: string,
	rawStylesXml?: string,
): ValidationResult {
	const docText = extractDocumentText(rawDocumentXml)
	const sourceFonts = extractSourceFonts(rawFontTableXml, rawStylesXml)

	const checks = [
		{ weight: 0.2, ...checkNameExists(blockTree, docText) },
		{ weight: 0.2, ...checkFontsExist(blockTree, sourceFonts) },
		{ weight: 0.2, ...checkExperienceCount(blockTree, rawDocumentXml) },
		{ weight: 0.15, ...checkSectionHeadingCount(blockTree, rawDocumentXml) },
		{ weight: 0.15, ...checkFontSizeSpotCheck(blockTree, rawDocumentXml) },
		{ weight: 0.1, ...checkNoPhantomContent(blockTree, docText) },
	]

	const confidence = checks.reduce(
		(sum, check) => sum + check.weight * check.score,
		0,
	)

	const issues = checks
		.filter(c => c.issue)
		.map(c => c.issue!)

	return { confidence, issues }
}
