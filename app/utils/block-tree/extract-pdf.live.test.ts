/**
 * Live integration tests for the PDF extraction pipeline.
 *
 * Runs real PDFs through the full pipeline (Python extraction → AI → validation → merge → render).
 * Outputs JSON and HTML files for manual visual review.
 *
 * NOT run in CI. Requires:
 * - Python 3 with pdfplumber installed
 * - ANTHROPIC_API_KEY or OPENAI_API_KEY env var
 * - LIVE_TEST=1 env var
 *
 * Run: LIVE_TEST=1 npx vitest run app/utils/block-tree/extract-pdf.live.test.ts
 */

import { describe, it, expect } from 'vitest'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { extractPdfData } from './extract-pdf.server'
import { extractBlockTreeFromPdf } from './extract-with-ai.server'
import { renderBlockTreeToHtml } from './render-html'
import type { HeaderContent } from './types'

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests', 'fixtures')
const OUTPUT_DIR = path.resolve(process.cwd(), 'tests', 'output', 'pdf-live')

const isLive = process.env.LIVE_TEST === '1'
const describeIf = isLive ? describe : describe.skip

describeIf('PDF extraction pipeline (live)', () => {
	it('extracts Bamboo resume', async () => {
		const pdfPath = path.join(FIXTURES_DIR, 'Brayan_Londono_Resume_Bamboo.pdf')
		const buffer = await readFile(pdfPath)

		// Step 1: Raw extraction
		const pdfData = await extractPdfData(buffer)
		await mkdir(OUTPUT_DIR, { recursive: true })
		await writeFile(
			path.join(OUTPUT_DIR, 'bamboo-raw.json'),
			JSON.stringify(pdfData, null, 2),
		)
		expect(pdfData.pages.length).toBeGreaterThan(0)
		expect(pdfData.pages[0].lines.length).toBeGreaterThan(0)
		console.log(`Raw extraction: ${pdfData.pages.length} pages, ${pdfData.pages[0].lines.length} lines on page 1`)

		// Step 2: Full pipeline
		const blockTree = await extractBlockTreeFromPdf(buffer)
		await writeFile(
			path.join(OUTPUT_DIR, 'bamboo-blocktree.json'),
			JSON.stringify(blockTree, null, 2),
		)
		expect(blockTree.blocks.length).toBeGreaterThan(0)
		expect(blockTree.blocks.find(b => b.type === 'header')).toBeTruthy()

		// Step 3: Render HTML
		const html = renderBlockTreeToHtml(blockTree)
		await writeFile(path.join(OUTPUT_DIR, 'bamboo.html'), html)

		// Basic assertions
		const headerBlock = blockTree.blocks.find(b => b.type === 'header')!
		const headerContent = headerBlock.content as HeaderContent
		expect(headerContent.name).toBeTruthy()
		expect(blockTree.fonts.length).toBeGreaterThan(0)
		expect(blockTree.fonts.every(f => f.url)).toBe(true)

		console.log(`BlockTree: ${blockTree.blocks.length} blocks, layout: ${blockTree.layout}`)
		console.log(`Name: ${headerContent.name}`)
		console.log(`Fonts: ${blockTree.fonts.map(f => f.matchedFont).join(', ')}`)
		console.log(`Output: ${OUTPUT_DIR}/bamboo.html`)
	}, 120_000)

	it('extracts Healthcare resume', async () => {
		const pdfPath = path.join(FIXTURES_DIR, 'Brayan Londono Healthcare Resume2.pdf')
		const buffer = await readFile(pdfPath)

		const pdfData = await extractPdfData(buffer)
		await mkdir(OUTPUT_DIR, { recursive: true })
		await writeFile(
			path.join(OUTPUT_DIR, 'healthcare-raw.json'),
			JSON.stringify(pdfData, null, 2),
		)

		const blockTree = await extractBlockTreeFromPdf(buffer)
		await writeFile(
			path.join(OUTPUT_DIR, 'healthcare-blocktree.json'),
			JSON.stringify(blockTree, null, 2),
		)

		const html = renderBlockTreeToHtml(blockTree)
		await writeFile(path.join(OUTPUT_DIR, 'healthcare.html'), html)

		expect(blockTree.blocks.length).toBeGreaterThan(0)

		const headerBlock = blockTree.blocks.find(b => b.type === 'header')!
		const headerContent = headerBlock.content as HeaderContent
		console.log(`BlockTree: ${blockTree.blocks.length} blocks, layout: ${blockTree.layout}`)
		console.log(`Name: ${headerContent.name}`)
		console.log(`Output: ${OUTPUT_DIR}/healthcare.html`)
	}, 120_000)
})
