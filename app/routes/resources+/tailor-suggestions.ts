import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { type ResumeData } from '~/utils/builder-resume.server.ts'
import {
	getTailorSuggestionsResponse,
	type TailorSuggestion,
} from '~/utils/openai.server.ts'

export type { TailorSuggestion }

export async function action({ request }: ActionFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 })
	}

	const formData = await request.formData()
	const resumeDataStr = formData.get('resumeData') as string
	const jobDescription = formData.get('jobDescription') as string

	if (!resumeDataStr || !jobDescription?.trim()) {
		return json(
			{ error: 'Resume data and job description are required' },
			{ status: 400 },
		)
	}

	let resumeData: ResumeData
	try {
		resumeData = JSON.parse(resumeDataStr) as ResumeData
	} catch {
		return json({ error: 'Invalid resume data' }, { status: 400 })
	}

	// Check that there's actual content to tailor
	const hasBullets = resumeData.experiences?.some(
		exp => exp.descriptions?.some(d => d.content?.trim()),
	)
	const hasSummary = !!resumeData.about?.trim()
	if (!hasBullets && !hasSummary) {
		return json(
			{ error: 'Add some experience or a summary first, then tailor.' },
			{ status: 400 },
		)
	}

	try {
		const { response } = await getTailorSuggestionsResponse({
			resume: resumeData,
			jobDescription,
		})

		const content = response.choices[0]?.message?.content
		if (!content) {
			return json(
				{ error: 'No response from AI. Please try again.' },
				{ status: 500 },
			)
		}

		const parsed = JSON.parse(content) as { suggestions: TailorSuggestion[] }

		if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
			return json(
				{ error: 'Unexpected AI response format. Please try again.' },
				{ status: 500 },
			)
		}

		return json({ suggestions: parsed.suggestions })
	} catch (error: any) {
		console.error('tailor-suggestions: AI error', error)

		if (error?.status === 429 || error?.message?.includes('rate_limit')) {
			return json(
				{ error: 'AI is busy — please try again in 30 seconds.' },
				{ status: 429 },
			)
		}

		return json(
			{ error: 'Something went wrong. Please try again.' },
			{ status: 500 },
		)
	}
}
