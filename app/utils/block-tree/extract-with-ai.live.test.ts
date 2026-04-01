/**
 * LIVE integration test — hits real AI API with Brayan's DOCX.
 *
 * NOT for CI. Run manually:
 *   AI_EXTRACTION_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... npx vitest run --config vitest.block-tree.config.ts extract-with-ai.live
 *
 * This is the quality gate. If this test doesn't pass with correct
 * design tokens, the prompt needs iteration.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { extractBlockTreeWithAI } from './extract-with-ai.server'
import type {
	HeaderContent,
	ExperienceContent,
	SkillsContent,
} from './types'

const FIXTURE_PATH = path.resolve('tests/fixtures/Final_Brayan Londono.docx')
const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
const hasFixture = fs.existsSync(FIXTURE_PATH)

describe.skipIf(!hasApiKey || !hasFixture)(
	'extractBlockTreeWithAI — LIVE (real API)',
	() => {
		it(
			'extracts Brayan DOCX with correct design tokens',
			async () => {
				const buffer = fs.readFileSync(FIXTURE_PATH)
				const tree = await extractBlockTreeWithAI(buffer)

				// --- Structural checks ---
				expect(tree.layout).toBe('single-column')
				expect(tree.blocks.length).toBeGreaterThanOrEqual(4) // header, summary/experience, education, skills at minimum
				expect(tree.pageSettings.width).toBeGreaterThan(0)

				// --- Header ---
				const headerBlock = tree.blocks.find(b => b.type === 'header')
				expect(headerBlock).toBeDefined()
				const header = headerBlock!.content as HeaderContent
				expect(header.name.toLowerCase()).toContain('brayan')
				expect(header.contact.length).toBeGreaterThanOrEqual(2) // at least email + one other

				// --- Fonts ---
				// Should detect Garamond (primary font)
				const allFontFamilies = [
					tree.globalTokens.fontFamily,
					...tree.blocks.map(b => b.tokens.fontFamily).filter(Boolean),
				]
				const hasGaramond = allFontFamilies.some(f =>
					f?.toLowerCase().includes('garamond'),
				)
				expect(hasGaramond).toBe(true)

				// Font URLs should be populated via matchFont
				expect(tree.fonts.length).toBeGreaterThan(0)
				expect(tree.fonts.every(f => f.url)).toBe(true)

				// --- Experience ---
				const expBlock = tree.blocks.find(b => b.type === 'experience')
				expect(expBlock).toBeDefined()
				const exp = expBlock!.content as ExperienceContent
				expect(exp.entries.length).toBeGreaterThanOrEqual(2)

				// First entry should have bullets
				expect(exp.entries[0].bullets.length).toBeGreaterThan(0)
				// Bullets should be InlineSegment[][]
				expect(Array.isArray(exp.entries[0].bullets[0])).toBe(true)
				expect(exp.entries[0].bullets[0][0]).toHaveProperty('text')

				// --- Section headings with borders ---
				const blocksWithDecorations = tree.blocks.filter(
					b => b.decorations.length > 0,
				)
				// Brayan's resume has section dividers (paragraph borders)
				expect(blocksWithDecorations.length).toBeGreaterThanOrEqual(1)

				// --- Design tokens quality checks ---
				// Name should be larger than body text
				const nameTokens = (headerBlock!.content as HeaderContent).headerTokens?.name
				const nameFontSize = nameTokens?.fontSize ?? headerBlock!.tokens.fontSize
				if (nameFontSize) {
					expect(nameFontSize).toBeGreaterThan(tree.globalTokens.fontSize)
				}

				// Colors should be hex
				expect(tree.globalTokens.color).toMatch(/^#[0-9a-fA-F]{3,8}$/)

				// --- Log for manual review ---
				console.log('\n=== LIVE EXTRACTION RESULT ===')
				console.log(`Layout: ${tree.layout}`)
				console.log(`Global font: ${tree.globalTokens.fontFamily} ${tree.globalTokens.fontSize}pt`)
				console.log(`Fonts found: ${tree.fonts.map(f => `${f.originalFont} → ${f.matchedFont}`).join(', ')}`)
				console.log(`Blocks: ${tree.blocks.map(b => `${b.type}${b.sectionHeader ? ` [${b.sectionHeader}]` : ''}`).join(', ')}`)
				console.log(`Experience entries: ${exp.entries.length}`)
				console.log(`Decorations: ${tree.blocks.reduce((sum, b) => sum + b.decorations.length, 0)}`)

				const skillsBlock = tree.blocks.find(b => b.type === 'skills')
				if (skillsBlock) {
					const skills = skillsBlock.content as SkillsContent
					console.log(`Skills format: ${skills.format}, count: ${skills.skills?.length ?? skills.categories?.length ?? 0}`)
				}

				// Check for smallCaps on name (Brayan's resume uses it)
				if (nameTokens?.textTransform) {
					console.log(`Name textTransform: ${nameTokens.textTransform}`)
				}
			},
			120000, // 2 minute timeout for API call
		)
	},
)
