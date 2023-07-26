import { useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	type Skill,
	type Education,
	type Experience,
	type Job,
} from '@prisma/client'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { Link, useFetcher } from '@remix-run/react'
import { z } from 'zod'
import { ErrorList } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
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

	const [form] = useForm({
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
			<div className="mb-5">
				<label className="text-accent text-body-xs">Summary</label>
				<p>{resume?.summary}</p>
			</div>
			<h2 className="mb-2 text-h2">Experience</h2>
			<div className="space-y-2">
				{resume?.experience.length
					? resume.experience.map(experience => (
							<div key={experience.id}>
								<Button asChild size="sm" variant="secondary">
									<Link to={`experiences/${experience.id}`}>
										Tailor {experience.employer} - {experience.role}
									</Link>
								</Button>
							</div>
					  ))
					: null}
			</div>
			<ErrorList errors={form.errors} id={form.errorId} />
		</resumeTailorFetcher.Form>
	)
}
