import {
	json,
	type ActionFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Form, useActionData } from '@remix-run/react'
import { z } from 'zod'
import { sendEmail } from '~/utils/email.server.ts'
import { useIsSubmitting } from '~/utils/misc.ts'

export const meta: MetaFunction = () => [
	{ title: 'Support | Resume Tailor' },
	{
		name: 'description',
		content: 'Contact the Resume Tailor team. A real person reads every message.',
	},
]

const SupportSchema = z.object({
	email: z.string().email('Enter a valid email so we can reply to you'),
	message: z
		.string()
		.min(10, 'Tell us a bit more so we can help')
		.max(5000, 'Message is too long'),
})

function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const result = SupportSchema.safeParse({
		email: formData.get('email'),
		message: formData.get('message'),
	})
	if (!result.success) {
		const { fieldErrors } = result.error.flatten()
		return json(
			{ status: 'error', errors: fieldErrors, formError: null } as const,
			{ status: 400 },
		)
	}
	const { email, message } = result.data
	const supportInbox = process.env.SUPPORT_EMAIL || 'hello@resumetailor.ai'
	const response = await sendEmail({
		to: supportInbox,
		subject: `Support request from ${email}`,
		text: `From: ${email}\n\n${message}`,
		html: `<p><strong>From:</strong> ${escapeHtml(email)}</p><p>${escapeHtml(
			message,
		).replace(/\n/g, '<br />')}</p>`,
	})
	if (response.status === 'error') {
		return json(
			{
				status: 'error',
				errors: null,
				formError:
					'Something went wrong sending your message. Please email us directly at hello@resumetailor.ai.',
			} as const,
			{ status: 500 },
		)
	}
	return json({ status: 'success', errors: null, formError: null } as const)
}

export default function SupportRoute() {
	const actionData = useActionData<typeof action>()
	const isSubmitting = useIsSubmitting()

	if (actionData?.status === 'success') {
		return (
			<div className="container mx-auto max-w-lg px-4 py-20 text-center">
				<h1 className="text-3xl font-bold">Message sent</h1>
				<p className="mt-4 text-muted-foreground">
					Thanks for reaching out. A real person reads every message — we
					will reply to your email as soon as we can.
				</p>
			</div>
		)
	}

	return (
		<div className="container mx-auto max-w-lg px-4 py-20">
			<h1 className="text-3xl font-bold">Support</h1>
			<p className="mt-2 text-muted-foreground">
				Stuck, found a bug, or have a billing question? Send us a message and
				we will get back to you by email.
			</p>
			<Form method="post" className="mt-8 flex flex-col gap-4">
				<div>
					<label htmlFor="email" className="text-sm font-medium">
						Your email
					</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						autoComplete="email"
						className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					/>
					{actionData?.errors?.email ? (
						<p className="mt-1 text-sm text-destructive">
							{actionData.errors.email[0]}
						</p>
					) : null}
				</div>
				<div>
					<label htmlFor="message" className="text-sm font-medium">
						How can we help?
					</label>
					<textarea
						id="message"
						name="message"
						required
						rows={6}
						minLength={10}
						maxLength={5000}
						className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					/>
					{actionData?.errors?.message ? (
						<p className="mt-1 text-sm text-destructive">
							{actionData.errors.message[0]}
						</p>
					) : null}
				</div>
				{actionData?.formError ? (
					<p className="text-sm text-destructive">{actionData.formError}</p>
				) : null}
				<button
					type="submit"
					disabled={isSubmitting}
					className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
				>
					{isSubmitting ? 'Sending…' : 'Send message'}
				</button>
			</Form>
		</div>
	)
}
