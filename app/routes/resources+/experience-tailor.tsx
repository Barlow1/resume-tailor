import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import * as Dialog from '@radix-ui/react-dialog'
import { json, type DataFunctionArgs } from '@remix-run/node'
import { useFetcher, useNavigate, useRouteLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { requireUserId } from '~/utils/auth.server.ts'
import { Button, ErrorList, TextareaField } from '~/utils/forms.tsx'
import { type Stringify } from '~/utils/misc.ts'
import { type Job } from '@prisma/client'
import { getExperienceResponse } from '~/utils/openai.server.ts'
import { prisma } from '~/utils/db.server.ts'

export const ExperienceTailorSchema = z.object({
	experience: z.string().min(1),
	tailoredExperience: z.string().optional(),
	jobTitle: z.string().min(1),
	jobDescription: z.string().min(1),
})

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: ExperienceTailorSchema,
		acceptMultipleErrors: () => true,
	})
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission, response: null } as const)
	}
	if (!submission.value) {
		return json(
			{
				status: 'error',
				submission,
				response: null,
			} as const,
			{ status: 400 },
		)
	}

	const values = submission.value

	const [response] = await Promise.all([
		getExperienceResponse(values),
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

	return json({ status: 'success', submission, response: response } as const)
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
	const navigate = useNavigate()
	const editData = useRouteLoaderData(
		'routes/users+/$username_+/jobs+/$jobId_+/tailor',
	) as { resume: any }

	const [form, fields] = useForm({
		id: 'experience-tailor',
		constraint: getFieldsetConstraint(ExperienceTailorSchema),
		lastSubmission: experienceTailorFetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ExperienceTailorSchema })
		},
		defaultValue: {
			experience: experience.responsibilities,
			tailoredExperience: experienceTailorFetcher.data?.response || '',
		},
		shouldRevalidate: 'onBlur',
	})
	const dismissModal = () => navigate('..', { preventScrollReset: true })

	return (
		<Dialog.Root open={true}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 backdrop-blur-[2px]" />
				<Dialog.Content
					onEscapeKeyDown={dismissModal}
					onInteractOutside={dismissModal}
					onPointerDownOutside={dismissModal}
					className="fixed left-1/2 top-1/2 w-[90vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 transform overflow-auto rounded-lg bg-night-500 p-12 shadow-lg"
				>
					<Dialog.Title asChild className="text-center">
						<h2 className="mb-2 text-h2 lg:mb-6">Tailor your experience ✨</h2>
					</Dialog.Title>
					<experienceTailorFetcher.Form
						method="post"
						action="/resources/experience-tailor"
						preventScrollReset
						{...form.props}
					>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<input name="id" type="hidden" value={experience?.id} />
								<input hidden name="jobTitle" value={job.title} />
								<input hidden name="jobDescription" value={job.content} />
								<input
									name="resumeId"
									type="hidden"
									value={editData?.resume?.id}
								/>
								<p>{editData.resume?.title}</p>
								<div className="py-5">
									<TextareaField
										labelProps={{
											htmlFor: fields.experience.id,
											children: 'Experience',
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
								<p>{job?.title}</p>
								{experienceTailorFetcher.data?.response ? (
									<div className="py-5">
										<TextareaField
											labelProps={{
												htmlFor: fields.tailoredExperience.id,
												children: 'Tailored Experience',
											}}
											textareaProps={{
												...conform.textarea(fields.tailoredExperience),
												autoComplete: 'tailoredExperience',
												value: experienceTailorFetcher.data?.response.trim(),
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
							<Button size="md" variant="secondary" type="reset">
								Reset
							</Button>
							<Button
								size="md"
								variant="primary"
								status={
									experienceTailorFetcher.state === 'submitting'
										? 'pending'
										: experienceTailorFetcher.data?.status ?? 'idle'
								}
								type="submit"
								disabled={experienceTailorFetcher.state !== 'idle'}
							>
								{experienceTailorFetcher.state === 'submitting'
									? 'Generating...'
									: 'Generate'}
							</Button>
						</div>
					</experienceTailorFetcher.Form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
