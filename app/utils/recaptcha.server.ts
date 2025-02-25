export async function getRecaptchaScore(
	token: string,
	key: string,
	score: number = 0.5,
): Promise<boolean> {
	const captchData = new URLSearchParams({
		secret: key,
		response: token,
	})

	try {
		// Sending a POST request to the reCAPTCHA API using fetch
		const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: captchData,
		})

		// Parsing the JSON response
		const result = (await res.json()) as {
			success: boolean
			score: number
		}
		console.log('recaptcha result:', result)
		if (result.success && result.score >= score) {
			return true
		} else {
			return false
		}
	} catch (e) {
		// Handling errors if the reCAPTCHA verification fails
		console.log('recaptcha error:', e)
		return false
	}
}
