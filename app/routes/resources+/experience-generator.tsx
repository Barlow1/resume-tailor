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

export const ExperienceGeneratorSchema = z.object({
	experience: z.string().min(1),
	generateedExperience: z.string().optional(),
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
				hasGeneratedResume: true,
				hasTailoredResume: false,
				ownerId: userId,
			},
			update: {
				hasGeneratedResume: true,
			},
			where: {
				ownerId: userId,
			},
		}),
	])

	return json({ status: 'success', response: response } as const)
}

export function ExperienceGenerator({
	experience,
	job,
}: {
	job: Stringify<Job>
	experience: {
		id: string
		employer: string
		role: string
		startDate: string | null
		endDate: string | null
		city: string | null
		state: string | null
		country: string | null
		responsibilities: string
	}
}) {
	const experienceGeneratorFetcher = useFetcher<typeof action>()
	const editData = useRouteLoaderData(
		'routes/users+/$username_+/jobs+/$jobId_+/generate',
	) as { resume: any }

	const [form, fields] = useForm({
		id: 'experience-generate',
		constraint: getFieldsetConstraint(ExperienceGeneratorSchema),
		onValidate({ formData }) {
			return parse(formData, { schema: ExperienceGeneratorSchema })
		},
		defaultValue: {
			experience: experience.responsibilities,
		},
		shouldRevalidate: 'onBlur',
	})
	const [content, setContent] = React.useState('')
	const [selectedExperiences, setSelectedExperiences] = React.useState('')

	let generatedList: string[] | undefined
	if (content) {
		try {
			generatedList = JSON.parse(content) as string[]
		} catch (err) {}
	}
	const [loading, setLoading] = React.useState(false)

	return (
		<>
			<h2 className="mb-6 text-h2 lg:mb-12">Generate your experience ✨</h2>
			<experienceGeneratorFetcher.Form
				method="post"
				action="/resources/experience-generate"
				preventScrollReset
				{...form.props}
			>
				<div className="grid grid-cols-2 gap-4">
					<div className="flex flex-row justify-around">
						<p className="align-center flex text-center">
							{'Select tailored experience items'}
						</p>
					</div>
					<div className="flex flex-row justify-around">
						<p className="align-center flex text-center">{job?.title}</p>
						{generatedList?.length ? (
							<CopyButton inputId={fields.generateedExperience.id ?? ''} />
						) : null}
					</div>
					<div>
						<input name="id" type="hidden" value={experience?.id} />
						<input hidden name="jobTitle" value={job.title} />
						<input hidden name="jobDescription" value={job.content} />
						<input name="resumeId" type="hidden" value={editData?.resume?.id} />

						<div className="py-5">
							<section className="flex max-h-96 justify-center overflow-auto rounded-md  bg-accent p-6">
								{generatedList ? (
									<ul className="flex max-w-full flex-col gap-4">
										{generatedList?.map(item => (
											<li key={item}>
												{
													<Button
														variant="secondary"
														size="tall"
														className="max-w-full px-2 py-10"
														onClick={() => {
															setSelectedExperiences(
																prev => prev + `\r\n • ${item}`,
															)
														}}
													>
														<span className="p-2 text-lg">+</span>
														<span>{item}</span>
													</Button>
												}
											</li>
										))}
									</ul>
								) : (
									<Button
										type="button"
										variant="outline"
										status={loading ? 'pending' : content ? 'success' : 'idle'}
										onClick={event => {
											if (content) setContent('')
											experienceGeneratorFetcher.submit(
												{},
												{
													method: 'POST',
													action: '/resources/experience-generator',
												},
											)
											setLoading(true)
											event.preventDefault()

											const jobTitle =
												// @ts-expect-error we'll fix this later probably...

												event.currentTarget.form.elements.jobTitle.value
											const jobDescription =
												// @ts-expect-error we'll fix this later probably...
												event.currentTarget.form.elements.jobDescription.value
											const sse = new EventSource(
												`/resources/completions?${new URLSearchParams({
													jobTitle,
													jobDescription,
												})}`,
											)

											sse.addEventListener('message', event => {
												setContent(
													prevContent =>
														prevContent +
														event.data.replace(/__NEWLINE__/g, '\n'),
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
										{loading ? 'Generating...' : 'Generate Options'}
									</Button>
								)}
							</section>
							<ErrorList errors={form.errors} id={form.errorId} />
						</div>
					</div>

					<div>
						<div className="py-5">
							<TextareaField
								labelProps={{
									htmlFor: fields.generateedExperience.id,
									'aria-label': 'Generated Experience',
								}}
								textareaProps={{
									...conform.textarea(fields.generateedExperience),
									autoComplete: 'generateedExperience',
									value: selectedExperiences,
									onChange: e => {
										setSelectedExperiences(
											e.target.value
										)
									},
								}}
								errors={fields.generateedExperience.errors}
								isAutoSize
								truncate
							/>
						</div>
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
							setSelectedExperiences('')
						}}
					>
						Reset
					</Button>
				</div>
			</experienceGeneratorFetcher.Form>
		</>
	)
}
