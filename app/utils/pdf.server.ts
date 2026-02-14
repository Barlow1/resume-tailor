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

	// Load Crimson Pro font weights before generating PDF
	await page.evaluate(async () => {
		await Promise.all([
			document.fonts.load('500 16px "Crimson Pro"'),
			document.fonts.load('800 16px "Crimson Pro"'),
		])
		await document.fonts.ready
	})

	const pdfBuffer = await page.pdf({
		printBackground: true,
		scale: 1.0,
		format: 'letter',
		margin: {
			top: '0.5in',
			right: '0.5in',
			bottom: '0.5in',
			left: '0.5in'
		}
	})

	await browser.close()
	return pdfBuffer
}

export function uint8ArrayToBase64(uint8Array: Uint8Array) {
	return Buffer.from(uint8Array).toString('base64');
}
