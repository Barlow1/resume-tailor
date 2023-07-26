import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, type DataFunctionArgs } from '@remix-run/node'
import { useFetcher, useRouteLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { requireUserId } from '~/utils/auth.server.ts'
import { type Stringify } from '~/utils/misc.ts'
import { type Job } from '@prisma/client'
import { prisma } from '~/utils/db.server.ts'
import React from 'react'
import CopyButton from '~/components/copy-button.tsx'
import { Button } from '~/components/ui/button.tsx'
import { TextareaField, ErrorList } from '~/components/forms.tsx'

export const ExperienceTailorSchema = z.object({
	experience: z.string().min(1),
	tailoredExperience: z.string().optional(),
	jobTitle: z.string().min(1),
	jobDescription: z.string().min(1),
})

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)

	const [response] = await Promise.all([
		prisma.gettingStartedProgress.upsert({
			create: {
				hasSavedJob: false,
				hasSavedResume: false,
				hasGeneratedResume: false,
				hasTailoredResume: true,
				ownerId: userId,
			},
			update: {
				hasTailoredResume: true,
			},
			where: {
				ownerId: userId,
			},
		}),
	])

	return json({ status: 'success', response: response } as const)
}

export function ExperienceTailor({
	experience,
	job,
}: {
	job: Stringify<Job>
	experience: {
		id: string
		employer: string
		role: string
		startDate: string
		endDate: string
		city: string
		state: string
		country: string
		responsibilities: string
	}
}) {
	const experienceTailorFetcher = useFetcher<typeof action>()
	const editData = useRouteLoaderData(
		'routes/users+/$username_+/jobs+/$jobId_+/tailor',
	) as { resume: any }

	const [form, fields] = useForm({
		id: 'experience-tailor',
		constraint: getFieldsetConstraint(ExperienceTailorSchema),
		onValidate({ formData }) {
			return parse(formData, { schema: ExperienceTailorSchema })
		},
		defaultValue: {
			experience: experience.responsibilities,
		},
		shouldRevalidate: 'onBlur',
	})
	const [content, setContent] = React.useState('')
	const [loading, setLoading] = React.useState(false)

	return (
		<>
			<h2 className="mb-6 text-h2 lg:mb-12">Tailor your experience ✨</h2>
			<experienceTailorFetcher.Form
				method="post"
				action="/resources/experience-tailor"
				preventScrollReset
				{...form.props}
			>
				<div className="grid grid-cols-2 gap-4">
					<div className="flex flex-row justify-around">
						<p className="align-center flex text-center">
							{editData.resume?.title ?? 'Current Resume'}
						</p>
					</div>
					<div className="flex flex-row justify-around">
						<p className="align-center flex text-center">{job?.title}</p>
						{content ? (
							<CopyButton inputId={fields.tailoredExperience.id ?? ''} />
						) : null}
					</div>
					<div>
						<input name="id" type="hidden" value={experience?.id} />
						<input hidden name="jobTitle" value={job.title} />
						<input hidden name="jobDescription" value={job.content} />
						<input name="resumeId" type="hidden" value={editData?.resume?.id} />

						<div className="py-5">
							<TextareaField
								labelProps={{
									htmlFor: fields.experience.id,
									"aria-label": 'Experience',
								}}
								textareaProps={{
									...conform.textarea(fields.experience),
									autoComplete: 'experience',
								}}
								errors={fields.experience.errors}
								isAutoSize
								truncate
							/>
							<ErrorList errors={form.errors} id={form.errorId} />
						</div>
					</div>

					<div>
						{content ? (
							<div className="py-5">
								<TextareaField
									labelProps={{
										htmlFor: fields.tailoredExperience.id,
										"aria-label": 'Tailored Experience',
									}}
									textareaProps={{
										...conform.textarea(fields.tailoredExperience),
										autoComplete: 'tailoredExperience',
										value: content,
									}}
									errors={fields.tailoredExperience.errors}
									isAutoSize
									truncate
								/>
							</div>
						) : null}
					</div>
				</div>
				<div className="flex justify-end gap-4">
					<Button
						variant="secondary"
						type="reset"
						onClick={() => {
							// because this is a controlled form, we need to reset the state
							// because the built-in browser behavior will no longer work.
							setContent('')
						}}
					>
						Reset
					</Button>
					<Button
						type="button"
						status={loading ? 'pending' : content ? 'success' : 'idle'}
						onClick={event => {
							if (content) setContent('')
							experienceTailorFetcher.submit(
								{},
								{ method: 'POST', action: '/resources/experience-tailor' },
							)
							setLoading(true)
							event.preventDefault()

							const jobTitle =
								// @ts-expect-error we'll fix this later probably...

								event.currentTarget.form.elements.jobTitle.value
							const jobDescription =
								// @ts-expect-error we'll fix this later probably...
								event.currentTarget.form.elements.jobDescription.value
							const experience =
								// @ts-expect-error we'll fix this later probably...
								event.currentTarget.form.elements.experience.value
							const sse = new EventSource(
								`/resources/completions?${new URLSearchParams({
									jobTitle,
									jobDescription,
									experience,
								})}`,
							)

							sse.addEventListener('message', event => {
								setContent(
									prevContent =>
										prevContent + event.data.replace(/__NEWLINE__/g, '\n'),
								)
							})

							sse.addEventListener('error', event => {
								setLoading(false)
								console.log('error: ', event)
								sse.close()
							})
						}}
						disabled={loading}
					>
						{loading ? 'Generating...' : 'Generate Experience'}
					</Button>
				</div>
			</experienceTailorFetcher.Form>
		</>
	)
}
