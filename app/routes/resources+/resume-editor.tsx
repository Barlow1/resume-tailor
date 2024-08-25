import { useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { type Skill, type Education, type Experience } from '@prisma/client'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { Link, useFetcher, useResolvedPath } from '@remix-run/react'
import { z } from 'zod'
import { ErrorList } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { type Stringify } from '~/utils/misc.ts'

export const ResumeEditorSchema = z.object({
	id: z.string().optional(),
	// title: z.string().min(1),
	// summary: z.string().min(1),
	// firstName: z.string().min(1),
	// lastName: z.string().min(1),
	// email: z.string().email(),
	// phone: z.string().min(1),
	// city: z.string().min(1),
	// state: z.string().min(1),
	// country: z.string().min(1),
	currentRoute: z.string().min(1),
})

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: ResumeEditorSchema,
		acceptMultipleErrors: () => true,
	})
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value) {
		return json(
			{
				status: 'error',
				submission,
			} as const,
			{ status: 400 },
		)
	}

	const {
		// title,
		// summary,
		id,
		// firstName,
		// lastName,
		// email,
		// phone,
		// city,
		// state,
		// country,
		currentRoute,
	} = submission.value

	const data = {
		ownerId: userId,
		// title,
		// summary,
		// firstName,
		// lastName,
		// email,
		// phone,
		// city,
		// state,
		// country,
	}

	const select = {
		id: true,
		owner: {
			select: {
				username: true,
			},
		},
	}
	if (id) {
		const existingResume = await prisma.resume.findFirst({
			where: { id, ownerId: userId },
			select: { id: true },
		})
		if (!existingResume) {
			return json(
				{
					status: 'error',
					submission,
				} as const,
				{ status: 404 },
			)
		}
		await prisma.resume.update({
			where: { id },
			data,
			select,
		})
	} else {
		await prisma.resume.create({ data, select })
	}

	const formAction = formData.get('action')

	if (formAction === 'save') {
		await prisma.gettingStartedProgress.upsert({
			create: {
				hasSavedJob: false,
				hasSavedResume: true,
				hasGeneratedResume: false,
				hasTailoredResume: false,
				ownerId: userId,
			},
			update: {
				hasSavedResume: true,
			},
			where: {
				ownerId: userId,
			},
		})
	}

	switch (formAction) {
		case 'experience':
			return redirect(`${currentRoute}/experiences/new`)
		case 'education':
			return redirect(`${currentRoute}/education/new`)
		case 'skill':
			return redirect(`${currentRoute}/skills/new`)
		case 'save':
			return redirect(`${currentRoute}`)
		default:
			return redirect(`${currentRoute}`)
	}
}

export function ResumeEditor({
	resume,
}: {
	resume?: {
		id: string
		title: string | null
		summary: string | null
		firstName: string | null
		lastName: string | null
		email: string | null
		phone: string | null
		city: string | null
		state: string | null
		fileId: string | null
		country: string | null
		experience: Stringify<Experience>[]
		education: Stringify<Education>[]
		skills: Stringify<Skill>[]
	} | null
}) {
	const resumeEditorFetcher = useFetcher<typeof action>()

	const currentRoute = useResolvedPath('.')

	const [form] = useForm({
		id: 'resume-editor',
		constraint: getFieldsetConstraint(ResumeEditorSchema),
		lastSubmission: resumeEditorFetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ResumeEditorSchema })
		},
		defaultValue: {
			// title: resume?.title ?? undefined,
			// summary: resume?.summary ?? undefined,
			// firstName: resume?.firstName ?? undefined,
			// lastName: resume?.lastName ?? undefined,
			// email: resume?.email ?? undefined,
			// phone: resume?.phone ?? undefined,
			// city: resume?.city ?? undefined,
			// state: resume?.state ?? undefined,
			// country: resume?.country ?? undefined,
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<resumeEditorFetcher.Form
			method="post"
			action="/resources/resume-editor"
			preventScrollReset
			{...form.props}
		>
			<input name="id" type="hidden" value={resume?.id} />
			<input name="currentRoute" type="hidden" value={currentRoute.pathname} />
			<div className="space-y-5">
				<div>
					<div className="flex justify-between">
						<h2 className="mb-2 text-h2">Edit Resume</h2>
						<div className="flex justify-end gap-4">
							<Button
								type="submit"
								name="action"
								value={'save'}
								className="mt-2"
							>
								Save
							</Button>
						</div>
					</div>
					<p className="mb-2 text-gray-300">
						Add the experience and skills you want to tailor
					</p>
				</div>
				<div>
					<h2 className="mb-2 text-h5">Experience</h2>
					<div className="space-y-3">
						{resume?.experience.length
							? resume.experience.map(experience => (
									<div key={experience.id}>
										<Link
											// eslint-disable-next-line remix-react-routes/require-valid-paths
											to={`experiences/${experience.id}/edit`}
											preventScrollReset
										>
											<li className="list-none rounded-lg border border-gray-200 p-5 dark:border-gray-400">
												{experience.employer} - {experience.role}
												<svg
													className="float-right fill-gray-200 dark:fill-gray-400"
													xmlns="http://www.w3.org/2000/svg"
													height="1em"
													viewBox="0 0 512 512"
												>
													<path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z" />
												</svg>
											</li>
										</Link>
									</div>
							  ))
							: null}
					</div>
					<Button
						size="pill"
						variant="secondary"
						type="submit"
						className="mt-2"
						value={'experience'}
						name="action"
					>
						Add new experience +
					</Button>
				</div>
				<div>
					<h2 className="mb-2 text-h5">Skills</h2>
					<div className="space-y-3">
						{resume?.skills.length
							? resume.skills.map(skills => (
									<div key={skills.id}>
										{/* eslint-disable-next-line remix-react-routes/require-valid-paths */}
										<Link to={`skills/${skills.id}/edit`} preventScrollReset>
											<li className="list-none rounded-lg border border-gray-200 p-5 dark:border-gray-400">
												{skills.name}
												<svg
													className="float-right fill-gray-200 dark:fill-gray-400"
													xmlns="http://www.w3.org/2000/svg"
													height="1em"
													viewBox="0 0 512 512"
												>
													<path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z" />
												</svg>
											</li>
										</Link>
									</div>
							  ))
							: null}
					</div>
					<Button
						size="pill"
						variant="secondary"
						type="submit"
						className="mt-2"
						value={'skill'}
						name="action"
					>
						Add new skill +
					</Button>
				</div>
			</div>
			{/* <Field
				labelProps={{ htmlFor: fields.title.id, children: 'Title' }}
				inputProps={{
					...conform.input(fields.title),
					autoComplete: 'title',
				}}
				errors={fields.title.errors}
			/>
			<TextareaField
				labelProps={{ htmlFor: fields.summary.id, children: 'Summary' }}
				textareaProps={{
					...conform.textarea(fields.summary),
					autoComplete: 'summary',
				}}
				errors={fields.summary.errors}
			/>
			<h2 className="mb-2 text-h2">Contact</h2>
			<div className="grid grid-cols-2 gap-2">
				<Field
					labelProps={{ htmlFor: fields.firstName.id, children: 'First Name' }}
					inputProps={{
						...conform.input(fields.firstName),
						autoComplete: 'firstName',
					}}
					errors={fields.firstName.errors}
				/>
				<Field
					labelProps={{ htmlFor: fields.lastName.id, children: 'Last Name' }}
					inputProps={{
						...conform.input(fields.lastName),
						autoComplete: 'lastName',
					}}
					errors={fields.lastName.errors}
				/>
				<Field
					labelProps={{ htmlFor: fields.email.id, children: 'Email' }}
					inputProps={{
						...conform.input(fields.email),
						autoComplete: 'email',
					}}
					errors={fields.email.errors}
				/>
				<Field
					labelProps={{ htmlFor: fields.phone.id, children: 'Phone Number' }}
					inputProps={{
						...conform.input(fields.phone),
						autoComplete: 'phone',
					}}
					errors={fields.phone.errors}
				/>
				<Field
					labelProps={{ htmlFor: fields.city.id, children: 'City' }}
					inputProps={{
						...conform.input(fields.city),
						autoComplete: 'city',
					}}
					errors={fields.city.errors}
				/>
				<Field
					labelProps={{ htmlFor: fields.state.id, children: 'State' }}
					inputProps={{
						...conform.input(fields.state),
						autoComplete: 'state',
					}}
					errors={fields.state.errors}
				/>
			</div>
			<Field
				labelProps={{ htmlFor: fields.country.id, children: 'Country' }}
				inputProps={{
					...conform.input(fields.country),
					autoComplete: 'country',
				}}
				errors={fields.country.errors}
			/> */}

			{/* <h2 className="mb-2 text-h2">Education</h2>
			{resume?.education.length
				? resume.education.map(education => (
						<div key={education.id}>
							<Link key={education.id} to={`education/${education.id}/edit`}>
								{education.school} - {education.field}
							</Link>
						</div>
				  ))
				: null}
			<Button
				size="xs"
				variant="secondary"
				type="submit"
				className="mt-2"
				value={'education'}
				name="action"
			>
				Add new education +
			</Button> */}
			<ErrorList errors={form.errors} id={form.errorId} />
			{/* <div className="flex justify-end gap-4">
				<Button variant="secondary" type="reset">
					Reset
				</Button>
				<Button
					size="pill"
					status={
						resumeEditorFetcher.state === 'submitting'
							? 'pending'
							: resumeEditorFetcher.data?.status ?? 'idle'
					}
					type="submit"
					disabled={resumeEditorFetcher.state !== 'idle'}
				>
					Save
				</Button>
			</div> */}
		</resumeEditorFetcher.Form>
	)
}
