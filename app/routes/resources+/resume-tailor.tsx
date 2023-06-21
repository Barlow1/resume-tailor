import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	type Skill,
	type Education,
	type Experience,
	type Job,
} from '@prisma/client'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import { z } from 'zod'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { ButtonLink, ErrorList, Field, TextareaField } from '~/utils/forms.tsx'
import { type Stringify } from '~/utils/misc.ts'

export const ResumeEditorSchema = z.object({
	id: z.string().optional(),
	title: z.string().min(1),
	summary: z.string().min(1),
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	email: z.string().email(),
	phone: z.string().min(1),
	city: z.string().min(1),
	state: z.string().min(1),
	country: z.string().min(1),
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
	let resume: { id: string; owner: { username: string } }

	const {
		title,
		summary,
		id,
		firstName,
		lastName,
		email,
		phone,
		city,
		state,
		country,
	} = submission.value

	const data = {
		ownerId: userId,
		title,
		summary,
		firstName,
		lastName,
		email,
		phone,
		city,
		state,
		country,
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
		resume = await prisma.resume.update({
			where: { id },
			data,
			select,
		})
	} else {
		resume = await prisma.resume.create({ data, select })
	}
	return redirect(`/users/${resume.owner.username}/resume/edit`)
}

export function ResumeTailor({
	resume,
}: {
	job?: Stringify<Job>
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
	}
}) {
	const resumeTailorFetcher = useFetcher<typeof action>()

	const [form, fields] = useForm({
		id: 'resume-tailor',
		constraint: getFieldsetConstraint(ResumeEditorSchema),
		lastSubmission: resumeTailorFetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ResumeEditorSchema })
		},
		defaultValue: {
			title: resume?.title ?? undefined,
			summary: resume?.summary ?? undefined,
			firstName: resume?.firstName ?? undefined,
			lastName: resume?.lastName ?? undefined,
			email: resume?.email ?? undefined,
			phone: resume?.phone ?? undefined,
			city: resume?.city ?? undefined,
			state: resume?.state ?? undefined,
			country: resume?.country ?? undefined,
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<resumeTailorFetcher.Form
			method="post"
			action="/resources/resume-tailor"
			{...form.props}
		>
			<input name="id" type="hidden" value={resume?.id} />
			<Field
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
			/>
			<h2 className="mb-2 text-h2">Experience</h2>
			<div className="space-y-2">
				{resume?.experience.length
					? resume.experience.map(experience => (
							<div key={experience.id}>
								<ButtonLink
									size="sm"
									variant="secondary"
									to={`experiences/${experience.id}`}
								>
									Tailor {experience.employer} - {experience.role}
								</ButtonLink>
							</div>
					  ))
					: null}
			</div>
			<h2 className="mb-2 text-h2">Education</h2>
			{resume?.education.length
				? resume.education.map(education => (
						<div key={education.id}>
							<p key={education.id}>
								{education.school} - {education.field}
							</p>
						</div>
				  ))
				: null}
			<h2 className="mb-2 text-h2">Skills</h2>
			{resume?.skills.length
				? resume.skills.map(skill => (
						<div key={skill.id}>
							<p key={skill.id}>{skill.name}</p>
						</div>
				  ))
				: null}
			<ErrorList errors={form.errors} id={form.errorId} />
		</resumeTailorFetcher.Form>
	)
}
