import puppeteer from 'puppeteer'

export async function getPdfFromHtml(html: string): Promise<Uint8Array> {
	const browser = await puppeteer.launch({ headless: true })

	const page = await browser.newPage()
	await page.setContent(html, {
		waitUntil: 'networkidle0'
	})

	// Optional: Set viewport and other settings
	await page.setViewport({ width: 1425, height: 1900 })

	const pdfBuffer = await page.pdf({
		printBackground: true,
		scale: 0.7,
		format: 'A4',
		margin: {
			top: '20px',
			right: '20px',
			bottom: '20px',
			left: '20px'
		}
	})

	await browser.close()
	return pdfBuffer
}

export function uint8ArrayToBase64(uint8Array: Uint8Array) {
	return Buffer.from(uint8Array).toString('base64');
}
