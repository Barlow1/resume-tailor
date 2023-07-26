import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { useFetcher, useRouteLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { ErrorList, Field, TextareaField } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { type User } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export const EducationEditorSchema = z.object({
	id: z.string().optional(),
	resumeId: z.string().min(1),
	school: z.string().min(1),
	field: z.string().min(1),
	graduationDate: z.string().min(1),
	city: z.string().min(1),
	state: z.string().min(1),
	country: z.string().min(1),
	achievements: z.string().min(1),
})

export async function action({ request }: DataFunctionArgs) {
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: EducationEditorSchema,
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
	let education: { id: string; resume: { title: string | null; owner: User } }

	const {
		school,
		field,
		graduationDate,
		city,
		state,
		country,
		achievements,
		id,
		resumeId,
	} = submission.value

	const data = {
		graduationDate: new Date(graduationDate),
		school,
		field,
		city,
		state,
		country,
		achievements,
		resumeId,
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
		const existingEducation = await prisma.education.findFirst({
			where: { id, resumeId },
			select: { id: true },
		})
		if (!existingEducation) {
			return json(
				{
					status: 'error',
					submission,
				} as const,
				{ status: 404 },
			)
		}
		education = await prisma.education.update({
			where: { id },
			data,
			select,
		})
	} else {
		education = await prisma.education.create({ data, select })
	}
	return redirect(`/users/${education.resume.owner.username}/resume/edit`)
}

export function EducationEditor({
	education,
}: {
	education?: {
		id: string
		school: string
		field: string
		graduationDate: string
		city: string
		state: string
		country: string
		achievements: string
	}
}) {
	const educationEditorFetcher = useFetcher<typeof action>()
	const editData = useRouteLoaderData(
		'routes/users+/$username_+/resume+/edit',
	) as { resume: any }

	const [form, fields] = useForm({
		id: 'education-editor',
		constraint: getFieldsetConstraint(EducationEditorSchema),
		lastSubmission: educationEditorFetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: EducationEditorSchema })
		},
		defaultValue: {
			school: education?.school,
			field: education?.field,
			graduationDate: education?.graduationDate,
			city: education?.city,
			state: education?.state,
			country: education?.country,
			achievements: education?.achievements,
			id: education?.id,
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<>
			<h2 className="mb-2 text-h2">{education ? 'Edit' : 'Add'} education</h2>
			<educationEditorFetcher.Form
				method="post"
				action="/resources/education-editor"
				preventScrollReset
				{...form.props}
			>
				<input name="id" type="hidden" value={education?.id} />
				<input name="resumeId" type="hidden" value={editData?.resume?.id} />
				<div className="grid grid-cols-2 gap-2">
					<Field
						labelProps={{
							htmlFor: fields.school.id,
							children: 'School',
						}}
						inputProps={{
							...conform.input(fields.school),
							autoComplete: 'school',
						}}
						errors={fields.school.errors}
					/>
					<Field
						labelProps={{
							htmlFor: fields.field.id,
							children: 'Field of Study',
						}}
						inputProps={{
							...conform.input(fields.field),
							autoComplete: 'field',
						}}
						errors={fields.field.errors}
					/>
					<Field
						labelProps={{
							htmlFor: fields.graduationDate.id,
							children: 'Graduation Date',
						}}
						inputProps={{
							...conform.input(fields.graduationDate),
							autoComplete: 'graduationDate',
							type: 'date',
						}}
						errors={fields.graduationDate.errors}
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
					/>
				</div>
				<TextareaField
					labelProps={{
						htmlFor: fields.achievements.id,
						children: 'Achievements',
					}}
					textareaProps={{
						...conform.textarea(fields.achievements),
						autoComplete: 'achievements',
					}}
					errors={fields.achievements.errors}
				/>
				<ErrorList errors={form.errors} id={form.errorId} />
				<div className="flex justify-end gap-4">
					<Button variant="secondary" type="reset">
						Reset
					</Button>
					<Button
						status={
							educationEditorFetcher.state === 'submitting'
								? 'pending'
								: educationEditorFetcher.data?.status ?? 'idle'
						}
						type="submit"
						disabled={educationEditorFetcher.state !== 'idle'}
					>
						Save
					</Button>
				</div>
			</educationEditorFetcher.Form>
		</>
	)
}
