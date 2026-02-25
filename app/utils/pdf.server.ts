import puppeteer from 'puppeteer'

export async function getPdfFromHtml(html: string): Promise<Uint8Array> {
	const browser = await puppeteer.launch({
		headless: true,
		executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-gpu',
			'--font-render-hinting=none'
		]
	})

	const page = await browser.newPage()
	await page.setContent(html, {
		waitUntil: 'networkidle0'
	})

	// Set viewport to match Letter paper dimensions at 96dpi
	await page.setViewport({ width: 816, height: 1056 })

	// Wait for all fonts (Google Fonts loaded via <link> tags) to be ready
	await page.evaluate(async () => {
		await document.fonts.ready
	})

	// Split content into physical page containers so Puppeteer renders each
	// as its own PDF page. Uses the same algorithm as the preview's
	// calculatePageBreaks (PAGE_HEIGHT=1056, PADDING=48, CONTENT=960).
	await page.evaluate(() => {
		const resume = document.querySelector('.resume') as HTMLElement
		if (!resume) return

		const PAGE_HEIGHT = 1056  // 11in at 96dpi
		const PADDING = 48        // .resume padding
		const CONTENT_HEIGHT = PAGE_HEIGHT - 2 * PADDING // 960px

		// Collect children into page buckets using the same break algorithm
		const children = Array.from(resume.children) as HTMLElement[]
		const pages: HTMLElement[][] = [[]]
		let currentPageUsed = 0

		for (const child of children) {
			if (child.classList.contains('page-gap')) continue
			if (child.classList.contains('page-break-marker')) continue

			const childHeight = child.offsetHeight
			const remainingOnPage = CONTENT_HEIGHT - currentPageUsed

			if (childHeight > remainingOnPage && currentPageUsed > 0) {
				pages.push([])
				currentPageUsed = childHeight
			} else {
				currentPageUsed += childHeight
			}

			pages[pages.length - 1].push(child)

			while (currentPageUsed >= CONTENT_HEIGHT) {
				currentPageUsed -= CONTENT_HEIGHT
			}
		}

		// Single page — no restructuring needed
		if (pages.length <= 1) return

		const parent = resume.parentElement!
		const bgColor = window.getComputedStyle(resume).backgroundColor || 'white'

		// Detach all children, then remove original .resume
		while (resume.firstChild) {
			resume.removeChild(resume.firstChild)
		}
		parent.removeChild(resume)

		// Create one .resume container per page
		pages.forEach((pageChildren, i) => {
			const pageDiv = document.createElement('div')
			pageDiv.className = 'resume'
			pageDiv.style.padding = `${PADDING}px`
			pageDiv.style.width = '816px'
			pageDiv.style.minHeight = `${PAGE_HEIGHT}px`
			pageDiv.style.boxSizing = 'border-box'
			pageDiv.style.backgroundColor = bgColor
			pageDiv.style.position = 'relative'

			if (i > 0) {
				pageDiv.style.breakBefore = 'page'
				pageDiv.style.pageBreakBefore = 'always'
			}

			pageChildren.forEach(child => pageDiv.appendChild(child))
			parent.appendChild(pageDiv)
		})
	})

	const pdfBuffer = await page.pdf({
		printBackground: true,
		scale: 1.0,
		format: 'letter',
		margin: {
			top: '0',
			right: '0',
			bottom: '0',
			left: '0'
		}
	})

	await browser.close()
	return pdfBuffer
}

export function uint8ArrayToBase64(uint8Array: Uint8Array) {
	return Buffer.from(uint8Array).toString('base64');
}
