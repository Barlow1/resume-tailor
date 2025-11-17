import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import type { User } from '@prisma/client'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import { z } from 'zod'
import { Field, TextareaField, ErrorList } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { prisma } from '~/utils/db.server.ts'

export const ExperienceEditorSchema = z.object({
	id: z.string().optional(),
	resumeId: z.string().min(1),
	redirectTo: z.string().optional(),
	employer: z.string().min(1),
	role: z.string().min(1),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	country: z.string().optional(),
	responsibilities: z.string().min(1),
})

export async function action({ request }: DataFunctionArgs) {
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: ExperienceEditorSchema,
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
	let experience: { id: string; resume: { title: string | null; owner: User } }

	const {
		employer,
		role,
		startDate,
		endDate,
		city,
		state,
		country,
		responsibilities,
		id,
		resumeId,
		redirectTo,
	} = submission.value

	const data = {
		resumeId,
		startDate: startDate,
		endDate: endDate,
		employer,
		role,
		city,
		state,
		country,
		responsibilities,
	}

	const select = {
		id: true,
		resume: {
			select: {
				title: true,
				owner: true,
			},
		},
	}
	if (id) {
		const existingExperience = await prisma.experience.findFirst({
			where: { id, resumeId },
			select: { id: true },
		})
		if (!existingExperience) {
			return json(
				{
					status: 'error',
					submission,
				} as const,
				{ status: 404 },
			)
		}
		experience = await prisma.experience.update({
			where: { id },
			data,
			select,
		})
	} else {
		experience = await prisma.experience.create({ data, select })
	}
	return redirect( redirectTo || `/users/${experience.resume.owner.username}/resume/edit`)
}

export function ExperienceEditor({
	experience,
	resume,
	redirectTo,
}: {
	experience?: {
		id: string
		employer: string | null
		role: string | null
		startDate: string | null
		endDate: string | null
		city: string | null
		state: string | null
		country: string | null
		responsibilities: string | null
	}
	resume: { id: string }
	redirectTo?: string;
}) {
	const experienceEditorFetcher = useFetcher<typeof action>()

	const [form, fields] = useForm({
		id: 'experience-editor',
		constraint: getFieldsetConstraint(ExperienceEditorSchema),
		lastSubmission: experienceEditorFetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ExperienceEditorSchema })
		},
		defaultValue: {
			employer: experience?.employer,
			role: experience?.role,
			startDate: experience?.startDate,
			endDate: experience?.endDate,
			city: experience?.city,
			state: experience?.state,
			country: experience?.country,
			responsibilities: experience?.responsibilities,
			id: experience?.id,
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<>
			<h2 className="mb-2 text-h2">{experience ? 'Edit' : 'Add'} experience</h2>
			<experienceEditorFetcher.Form
				method="POST"
				action="/resources/experience-editor"
				preventScrollReset
				{...form.props}
			>
				<input name="id" type="hidden" value={experience?.id} />
				<input name="resumeId" type="hidden" value={resume?.id} />
				<input
					name="redirectTo"
					type="hidden"
					value={redirectTo}
				/>
				<div className="grid grid-cols-2 gap-2">
					<Field
						labelProps={{
							htmlFor: fields.employer.id,
							children: 'Employer',
						}}
						inputProps={{
							...conform.input(fields.employer),
							autoComplete: 'employer',
							autoFocus: true,
						}}
						errors={fields.employer.errors}
					/>
					<Field
						labelProps={{ htmlFor: fields.role.id, children: 'Role' }}
						inputProps={{
							...conform.input(fields.role),
							autoComplete: 'role',
						}}
						errors={fields.role.errors}
					/>
					{/* <Field
						labelProps={{
							htmlFor: fields.startDate.id,
							children: 'Start Date',
						}}
						inputProps={{
							...conform.input(fields.startDate),
							autoComplete: 'startDate',
							type: 'month',
						}}
						errors={fields.startDate.errors}
					/>
					<Field
						labelProps={{
							htmlFor: fields.endDate.id,
							children: 'End Date',
						}}
						inputProps={{
							...conform.input(fields.endDate),
							autoComplete: 'endDate',
							type: 'month',
						}}
						errors={fields.endDate.errors}
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
				<Field
					labelProps={{
						htmlFor: fields.country.id,
						children: 'Country',
					}}
					inputProps={{
						...conform.input(fields.country),
						autoComplete: 'country',
					}}
					errors={fields.country.errors}
				/> */}
				</div>
				<TextareaField
					labelProps={{
						htmlFor: fields.responsibilities.id,
						children: 'Responsibilities',
					}}
					textareaProps={{
						...conform.textarea(fields.responsibilities),
						autoComplete: 'responsibilities',
					}}
					errors={fields.responsibilities.errors}
				/>
				<ErrorList errors={form.errors} id={form.errorId} />
				<div className="flex justify-end gap-4">
					<Button variant="secondary" type="reset">
						Reset
					</Button>
					<Button
						status={
							experienceEditorFetcher.state === 'submitting'
								? 'pending'
								: experienceEditorFetcher.data?.status ?? 'idle'
						}
						type="submit"
						disabled={experienceEditorFetcher.state !== 'idle'}
					>
						Save
					</Button>
				</div>
			</experienceEditorFetcher.Form>
		</>
	)
}
