import OpenAI from 'openai'
import type { BlockTree } from './types'
import type { PdfExtractionResult, PdfPageImage } from './extract-pdf.server'

const TEMPLATE_GENERATION_PROMPT = `You are a resume design reproduction system. You receive either:
- Images of a PDF resume (vision path), OR
- Structured positional data extracted from a PDF (text path)

Plus a BlockTree JSON containing the already-extracted content (name, experience entries, skills, etc.)

Your job: generate a SINGLE self-contained HTML document that visually reproduces the original resume design as closely as possible.

## REQUIREMENTS

1. **Visual fidelity is everything.** The HTML should look nearly identical to the original when rendered at 816x1056px. Match the exact layout, fonts, colors, spacing, decorations, and typography.

2. **Use the BlockTree content.** The text content (names, titles, companies, bullets, skills, etc.) comes from the BlockTree JSON provided. Use it verbatim — do NOT re-extract text from the image or positional data. The visual reference is ONLY for design decisions.

3. **Mark every editable element** with data attributes:
   - \`data-block-id\`: matches the block's \`id\` field in the BlockTree (e.g., "header-0", "experience-1")
   - \`data-field\`: the content field path (e.g., "name", "role", "entries.0.company", "entries.0.bullets.0", "text")
   - Example: \`<h1 data-block-id="header-0" data-field="name">Brayan Londono</h1>\`
   - For bullet points: each \`<li>\` gets \`data-block-id="experience-1" data-field="entries.0.bullets.0"\`
   - For contact items: \`data-block-id="header-0" data-field="contact.0.value"\`, \`data-field="contact.1.value"\`, etc.
   - For skills (flat list): each skill gets \`data-field="skills.0"\`, \`data-field="skills.1"\`, etc.
   - For skill categories: \`data-field="categories.0.skills"\` (comma-separated)
   - For section headers: \`data-field="sectionHeader"\`

4. **Font selection**: Choose the closest match from this list:
   Inter, Raleway, Garamond, EB Garamond, Crimson Pro, Titillium Web, PT Sans, Arimo, Gabarito, Abril Fatface, Open Sans, Roboto, Lato, Montserrat, Poppins, Source Sans Pro, Nunito, Playfair Display, Merriweather, Oswald, Barlow, Libre Baskerville, Noto Sans, Work Sans, Rubik, DM Sans, Mulish, Quicksand, Cabin, Karla, Fira Sans, IBM Plex Sans, Manrope, Space Grotesk, Lexend, Ubuntu, Archivo.
   Never return generic descriptions like "sans-serif" or "serif". Always pick a specific font.

5. **HTML structure rules:**
   - Start with \`<!DOCTYPE html>\` — full valid HTML document
   - Include Google Fonts \`<link>\` tags in \`<head>\` for all fonts used
   - ALL styles must be inline (\`style="..."\`) — no \`<style>\` block, no external CSS
   - No images, no SVG, no external resources (except Google Fonts)
   - The root resume container: \`<div class="resume" style="width: 816px; min-height: 1056px; ...">\`
   - Use \`background: #ffffff\` on the resume container
   - Body background: \`#e8e8e8\`

6. **Layout reproduction:**
   - For sidebar layouts: use CSS Grid to create the exact column structure
   - For colored sidebar/banner backgrounds: apply background-color to the region container
   - For two-column layouts: match the exact column widths/ratios
   - Match margins and padding exactly

7. **Typography reproduction:**
   - Font sizes in pt (e.g., \`font-size: 22pt\`)
   - Font weights exactly (400, 700, etc.)
   - Colors as hex
   - text-transform for uppercase headings
   - letter-spacing if the original has tracked-out text
   - line-height if distinguishable

8. **Decoration reproduction:**
   - Horizontal rules/dividers: use \`<hr>\` or \`border-bottom\` with exact color/thickness
   - Colored region backgrounds: apply directly
   - Vertical accent bars: border-left
   - Bullet styling: match the original bullet character (•, -, ▪, etc.)
   - **Section heading underlines**: If the original has a line/divider under section headings (EXPERIENCE, EDUCATION, SKILLS, etc.), add a \`border-bottom\` to the heading element. This is common — look carefully at the original.

9. **Experience entry layout:**
   - Reproduce the exact pattern (company-left/date-right, title below, etc.)
   - Use flexbox with justify-content: space-between for side-by-side elements
   - Each entry gets \`data-entry-index="0"\`, \`data-entry-index="1"\`, etc.

10. **Contact line layout:**
    - If contact items are spread across the full width with separators (|, /, •), use \`display: flex; justify-content: space-between; width: 100%;\` — each contact item as a flex child
    - Do NOT bunch contact items together with small padding. Match the visual spacing from the original: items should be evenly distributed across the available width
    - Separator characters between items should be inline text, not separate elements

11. **Skills rendering:**
    - If skills in the BlockTree have \`format: "tags"\`, render each skill as a **pill/tag shape**: \`display: inline-block; padding: 4px 14px; border: 1px solid [accent-color]; border-radius: 16px; margin: 3px 4px;\`
    - Match the border color to the accent color from the original design (usually a muted version of the heading color)
    - If skills have \`format: "categories"\`, render as \`Category Name: skill1, skill2, skill3\`
    - If skills have \`format: "rated"\` with dots or bars, reproduce the visual rating indicators
    - If skills have \`format: "list"\` or \`format: "inline"\`, render as comma-separated text

12. **Vertical spacing and breathing room:**
    - Match the visual density of the original. Resumes typically have generous spacing between sections.
    - Between the name and role/subtitle: 8-12px
    - Between the role and summary paragraph: 16-20px
    - Between the summary and contact line: 16-20px
    - Between the contact divider and column content: 20-28px
    - Between section headings and their content: 10-14px
    - Between experience entries: 16-20px
    - Do NOT compress spacing — err on the side of MORE space between elements. A cramped resume looks wrong. Look at the original carefully and match its visual rhythm.

## CRITICAL CSS CONSTRAINTS FOR CONTENT REFLOW

The template WILL be re-used with different content lengths. It must not break when:
- A summary paragraph doubles in length
- An experience entry adds 3 more bullets
- A new experience entry is added
- Skills list grows from 5 to 15 items
- Name changes from "David Pérez" to "Alexandria Konstantinopoulou-Richardson"

Therefore:
- **NO fixed heights** on any container. Use min-height if needed, never height.
- **NO absolute positioning** for text content. Only use absolute positioning for decorative elements (background shapes, accent bars).
- Use **flexbox and grid** for layout — they reflow naturally when content changes.
- Bullet lists must **grow/shrink freely** when items are added or removed.
- The page container should be **min-height: 1056px**, not fixed height.
- Two-column layouts: use **CSS grid with fr units** so columns maintain proportions as content grows.
- If a sidebar has a background color, it must **extend to full height** of the content (use min-height: 100% on the grid, not a fixed pixel value).

This is the constraint that separates "screenshot as HTML" from "actual editable template." The CSS must be structural, not positional.

## WHAT NOT TO DO
- Do NOT use a \`<style>\` block — all styles inline
- Do NOT add any text that isn't in the BlockTree
- Do NOT use placeholder text
- Do NOT add hover effects, transitions, or interactive styling
- Do NOT use \`contenteditable\` attributes
- Do NOT include vendor/template marketing pages
- Do NOT include photos/headshots
- Do NOT use fixed heights or absolute positioning on text containers

## OUTPUT
Return ONLY the HTML document. No markdown code fences. No explanations. Just the HTML starting with \`<!DOCTYPE html>\`.`

interface GenerateTemplateOptions {
	blockTree: BlockTree | null
	pageImages: PdfPageImage[]
}

export async function generateResumeTemplate(
	options: GenerateTemplateOptions,
): Promise<string> {
	const { blockTree, pageImages } = options

	if (!pageImages.length) {
		throw new Error('generateResumeTemplate requires page images')
	}

	const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 180000 })

	const fontLinks = blockTree?.fonts
		.filter(f => f.url)
		.map(f => f.url) ?? []

	const blockTreeJson = blockTree ? JSON.stringify(blockTree, null, 2) : null

	const imageContent = pageImages.map(img => ({
		type: 'image_url' as const,
		image_url: {
			url: `data:image/png;base64,${img.base64}`,
			detail: 'high' as const,
		},
	}))

	const hasContent = blockTree && blockTree.blocks.length > 0
	const pageDims = blockTree
		? `Page dimensions: ${blockTree.pageSettings.width}x${blockTree.pageSettings.height}px\nMargins: top=${blockTree.pageSettings.margins.top}px right=${blockTree.pageSettings.margins.right}px bottom=${blockTree.pageSettings.margins.bottom}px left=${blockTree.pageSettings.margins.left}px`
		: `Page dimensions: 816x1056px (standard US Letter)`

	const response = await client.chat.completions.create({
		model: 'gpt-5.4-mini',
		max_completion_tokens: 16000,
		messages: [
			{ role: 'system', content: TEMPLATE_GENERATION_PROMPT },
			{
				role: 'user',
				content: [
					...imageContent,
					{
						type: 'text',
						text: `The image(s) above show the original resume. Reproduce this design EXACTLY as HTML/CSS.

${hasContent
	? `Here is the structured content to populate the template with (use this text verbatim — do NOT re-read text from the image):\n\n${blockTreeJson}`
	: `No structured content was provided. Read ALL text content directly from the image and include it in the HTML. Still add data-block-id and data-field attributes to every editable element, using logical IDs like "header-0", "experience-1", etc.`}

${pageDims}
${fontLinks.length > 0 ? `Google Font URLs to include:\n${fontLinks.join('\n')}` : ''}

Generate the HTML template.`,
					},
				],
			},
		],
	})

	const html = response.choices[0]?.message?.content
	if (!html) throw new Error('Template generation returned no content')

	let cleaned = html.trim()
	if (cleaned.startsWith('```')) {
		cleaned = cleaned.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '')
	}

	return cleaned
}
