import * as React from 'react'
import type {
	ActionFunctionArgs,
	MetaFunction,
	LoaderFunctionArgs,
} from '@remix-run/node'
import { json } from '@remix-run/node'
import {
	Form,
	useActionData,
	useNavigation,
	useLoaderData,
	useNavigate,
} from '@remix-run/react'
import { useEffect, useState } from 'react'
import { writeRecruiterMessage } from '../../utils/ai-helpers.server.ts'
import {
	requireUserId,
	getUserId,
	getStripeSubscription,
} from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { SubscribeModal } from '~/components/subscribe-modal.tsx'

const FREE_LIMIT = 1000

// ---------------- Types ----------------

type Outreach = {
	email?: { subjects?: string[]; body?: string }
	linkedinDM?: { body?: string }
	connectionNote?: { body?: string }
	followUp?: { body?: string }
} | null

type ActionSuccess = {
	ok: true
	// echoing fields lets the UI repopulate or show what was used
	fields?: {
		jobTitle: string
		jobDescription: string
		resume: string
		recruiterName?: string
		name?: string
		username?: string
	}
	hasSubscription: boolean
	progress: { outreachCount: number }
	outreach?: Outreach
}

type ActionError = {
	ok: false
	// field-level validation errors
	errors?: Partial<
		Record<'jobTitle' | 'jobDescription' | 'resume' | 'imports', string>
	>
	// fields to repopulate the form on error
	fields?: {
		jobTitle?: string
		jobDescription?: string
		resume?: string
		recruiterName?: string
		name?: string
		username?: string
	}
	// subscription gating flag (optional so validation errors can omit it)
	requireSubscribe?: boolean
	// human-friendly message for generic/gated errors
	message?: string
}

type ActionData = ActionSuccess | ActionError

// ---------------- Meta ----------------

export const meta: MetaFunction = () => [
	{ title: 'Land more interviews — Recruiter Outreach Generator' },
	{
		name: 'description',
		content:
			"Paste your resume + JD, add the recruiter's name, and instantly get tailored email and LinkedIn messages you can send today.",
	},
]

// ---------------- Loader (public view) ----------------

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const userId = await getUserId(request) // no redirect; page is public
	if (!userId)
		return json({ userId: null, subscription: null, freeRemaining: null })

	const [subscription, progress] = await Promise.all([
		getStripeSubscription(userId),
		prisma.gettingStartedProgress.findUnique({
			where: { ownerId: userId },
			select: { outreachCount: true },
		}),
	])

	const freeUsed = progress?.outreachCount ?? 0
	const freeRemaining = Math.max(0, FREE_LIMIT - freeUsed)

	return json({
		userId,
		subscription: { active: !!subscription?.active },
		freeRemaining,
	})
}

// ---------------- Action helpers ----------------

function getText(
	fd: FormData,
	key: string,
	{ trim = true, max = 100_000 } = {},
) {
	const v = fd.get(key)
	if (typeof v !== 'string') return ''
	const s = trim ? v.trim() : v
	return s.length > max ? s.slice(0, max) : s
}

// ---------------- Action (redirect on use) ----------------

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)

	const fd = await request.formData()
	const jobTitle = getText(fd, 'jobTitle', { max: 256 })
	const jobDescription = getText(fd, 'jobDescription')
	const resume = getText(fd, 'resume')
	const recruiterName = getText(fd, 'recruiterName', { max: 256 })
	const nameRaw = fd.get('name')
	const usernameRaw = fd.get('username')
	const name =
		typeof nameRaw === 'string' ? nameRaw.trim() || undefined : undefined
	const username =
		typeof usernameRaw === 'string'
			? usernameRaw.trim() || undefined
			: undefined

	const errors: NonNullable<ActionError['errors']> = {}
	if (!jobTitle) errors.jobTitle = 'Job title is required'
	if (!jobDescription) errors.jobDescription = 'Job description is required'
	if (!resume) errors.resume = 'Resume (text) is required'

	if (Object.keys(errors).length) {
		return json<ActionError>(
			{
				ok: false,
				errors,
				fields: {
					jobTitle,
					jobDescription,
					resume,
					recruiterName,
					name,
					username,
				},
			},
			{ status: 400 },
		)
	}

	try {
		const subscription = await getStripeSubscription(userId)
		if (!subscription) {
			return json<ActionError>(
				{
					ok: false,
					requireSubscribe: false, // ✅ fixed typo (was reqireSubscribe)
					message: 'A paid subscription is required to generate outreach.',
					fields: {
						jobTitle,
						jobDescription,
						resume,
						recruiterName,
						name,
						username,
					},
				},
				{ status: 402 },
			)
		}

		const progress = await prisma.gettingStartedProgress.upsert({
			where: { ownerId: userId },
			update: {},
			create: {
				ownerId: userId,
				outreachCount: 0,
				hasSavedJob: false,
				hasSavedResume: false,
				hasTailoredResume: false,
				hasGeneratedResume: false,
			},
			select: { outreachCount: true },
		})

		// Optional: try to generate outreach; if helper signature differs, this stays safe.
		let outreach: Outreach = null
		try {
			// Adjust the call shape to match your helper's API as needed.
			const result = await writeRecruiterMessage({
				jobTitle,
				jobDescription,
				resume,
				recruiterName,
				user: { name, username },
			})
			// Extract just the outreach data, excluding the role field
			if (result.outreach) {
				const { role, ...outreachData } = result.outreach
				outreach = outreachData as Outreach
			}
		} catch {
			// If generation fails silently, still return success so UI renders.
			outreach = null
		}

		return json<ActionSuccess>({
			ok: true,
			hasSubscription: true,
			progress,
			fields: {
				jobTitle,
				jobDescription,
				resume,
				recruiterName,
				name,
				username,
			},
			outreach,
		})
	} catch (err) {
		console.error('action error:', err)
		return json<ActionError>(
			{ ok: false, message: 'Something went wrong. Please try again' },
			{ status: 500 },
		)
	}
}

// ---------------- UI ----------------

function CopyButton({ text }: { text?: string }) {
	const [copied, setCopied] = useState(false)
	if (!text) return null
	return (
		<button
			type="button"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(text)
					setCopied(true)
					setTimeout(() => setCopied(false), 1500)
				} catch {}
			}}
			className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
		>
			{copied ? 'Copied ✓' : 'Copy'}
		</button>
	)
}

export default function RecruiterOutreachPage() {
	const data = useActionData<ActionData>()
	const nav = useNavigation()
	const isSubmitting = nav.state === 'submitting'
	const { userId } = useLoaderData<typeof loader>()
	const navigate = useNavigate()

	const err = data && !data.ok ? (data as ActionError).errors : null
	const success = data && data.ok ? (data as ActionSuccess) : null

	const [showSubscribeModal, setShowSubscribeModal] = useState(false)
	const here = typeof window !== 'undefined' ? window.location.pathname : '/'

	// Local state + draft persistence
	const [jobTitle, setJobTitle] = useState('')
	const [recruiterName, setRecruiterName] = useState('')
	const [resumeText, setResumeText] = useState('')
	const [jdText, setJdText] = useState('')

	// Persist drafts as user types (keep your old key for backward compat)
	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('resume-draft-outreach', resumeText)
			localStorage.setItem('recruiter-resume', resumeText)
		}
	}, [resumeText])

	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('recruiter-jd', jdText)
		}
	}, [jdText])

	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('recruiter-jobTitle', jobTitle)
		}
	}, [jobTitle])

	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('recruiter-recruiterName', recruiterName)
		}
	}, [recruiterName])

	// Hydrate from server (on error/success) or from localStorage (fresh visit / after login)
	useEffect(() => {
		if (data && 'fields' in data && data.fields) {
			setResumeText(data.fields.resume || '')
			setJdText(data.fields.jobDescription || '')
			setJobTitle(data.fields.jobTitle || '')
			setRecruiterName((data.fields as any).recruiterName || '')
		} else if (typeof window !== 'undefined') {
			setResumeText(
				localStorage.getItem('recruiter-resume') ||
					localStorage.getItem('resume-draft-outreach') ||
					'',
			)
			setJdText(localStorage.getItem('recruiter-jd') || '')
			setJobTitle(localStorage.getItem('recruiter-jobTitle') || '')
			setRecruiterName(localStorage.getItem('recruiter-recruiterName') || '')
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Client safety net: if logged out, intercept submit, save drafts, and hop to login
	const handleAuthSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		if (!userId) {
			e.preventDefault()
			if (typeof window !== 'undefined') {
				localStorage.setItem('recruiter-resume', resumeText)
				localStorage.setItem('recruiter-jd', jdText)
				localStorage.setItem('recruiter-jobTitle', jobTitle)
				localStorage.setItem('recruiter-recruiterName', recruiterName)
				const backTo = window.location.pathname + window.location.search
				navigate(`/login?redirectTo=${encodeURIComponent(backTo)}`)
			}
		}
	}

	const showSubGate =
		data && !data.ok && (data as ActionError)?.requireSubscribe

	useEffect(() => {
		if (showSubGate) setShowSubscribeModal(true)
	}, [showSubGate])

	return (
		<div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
			<SubscribeModal
				isOpen={showSubscribeModal}
				onClose={() => setShowSubscribeModal(false)}
				successUrl={here}
				redirectTo={here}
				cancelUrl={here}
			/>
			{/* Hero */}
			<section className="mx-auto max-w-5xl px-6 pt-12">
				<div className="rounded-3xl border border-border bg-card/70 p-8 shadow-sm backdrop-blur">
					<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
						Get recruiter-ready messages in seconds
					</h1>
					<p className="mt-3 max-w-3xl text-base text-muted-foreground">
						Paste your{' '}
						<span className="font-medium text-foreground">resume</span> and the
						<span className="font-medium text-foreground">
							{' '}
							job description
						</span>
						, add the recruiter's name, and we'll craft polished{' '}
						<span className="font-medium text-foreground">
							email & LinkedIn messages
						</span>
						you can send today to land more interviews.
					</p>
					<ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
						<li className="flex items-center gap-2">
							<span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />{' '}
							Tailored to the role
						</li>
						<li className="flex items-center gap-2">
							<span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />{' '}
							Multiple message options
						</li>
						<li className="flex items-center gap-2">
							<span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" />{' '}
							Copy & send instantly
						</li>
					</ul>
				</div>
			</section>

			{/* Main */}
			<main className="mx-auto mt-8 grid max-w-5xl gap-6 px-6 md:grid-cols-5">
				{/* Form */}
				<div className="md:col-span-3">
					<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
						<h2 className="text-lg font-medium">Enter these fields</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Paste your resume and job description, add the recruiter's name,
							and we'll craft polished email and LinkedIn messages you can send
							today to land more interviews.
						</p>

						<Form
							method="post"
							className="mt-6 space-y-5"
							replace
							onSubmit={handleAuthSubmit}
						>
							<div>
								<label htmlFor="jobTitle" className="block text-sm font-medium">
									Job title
								</label>
								<input
									id="jobTitle"
									name="jobTitle"
									type="text"
									required
									placeholder="e.g., Senior Frontend Engineer"
									className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									aria-invalid={!!err?.jobTitle}
									value={jobTitle}
									onChange={e => setJobTitle(e.target.value)}
								/>
								{err?.jobTitle && (
									<p className="mt-1 text-sm text-destructive">
										{err.jobTitle}
									</p>
								)}
							</div>

							<div>
								<div className="flex items-center justify-between">
									<label
										htmlFor="recruiterName"
										className="block text-sm font-medium"
									>
										Recruiter or hiring manager
									</label>
									<span className="text-xs text-muted-foreground">
										Optional but recommended
									</span>
								</div>
								<input
									id="recruiterName"
									name="recruiterName"
									type="text"
									placeholder="e.g., Taylor Nguyen"
									className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									value={recruiterName}
									onChange={e => setRecruiterName(e.target.value)}
								/>
							</div>

							<div>
								<div className="flex items-center justify-between">
									<label
										htmlFor="jobDescription"
										className="block text-sm font-medium"
									>
										Job description
									</label>
								</div>
								<textarea
									id="jobDescription"
									name="jobDescription"
									rows={8}
									required
									placeholder="Paste the job description text here…"
									className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									aria-invalid={!!err?.jobDescription}
									value={jdText}
									onChange={e => setJdText(e.target.value)}
								/>
								{err?.jobDescription && (
									<p className="mt-1 text-sm text-destructive">
										{err.jobDescription}
									</p>
								)}
							</div>

							<div>
								<div className="flex items-center justify-between">
									<label htmlFor="resume" className="block text-sm font-medium">
										Resume
									</label>
								</div>
								<textarea
									id="resume"
									name="resume"
									rows={8}
									required
									placeholder="Paste your resume text here…"
									className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									aria-invalid={!!err?.resume}
									value={resumeText}
									onChange={e => setResumeText(e.target.value)}
								/>
								{err?.resume && (
									<p className="mt-1 text-sm text-destructive">{err.resume}</p>
								)}
							</div>

							<details className="rounded-md border border-border bg-muted/30 p-3">
								<summary className="cursor-pointer text-sm font-medium">
									Optional: personalize messages with your name
								</summary>
								<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div>
										<label htmlFor="name" className="block text-sm font-medium">
											Your name
										</label>
										<input
											id="name"
											name="name"
											type="text"
											className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
											placeholder="Alex Rivera"
											defaultValue={(data as any)?.fields?.name || ''}
										/>
									</div>
									<div>
										<label
											htmlFor="username"
											className="block text-sm font-medium"
										>
											Username (optional)
										</label>
										<input
											id="username"
											name="username"
											type="text"
											className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
											placeholder="arivera"
											defaultValue={(data as any)?.fields?.username || ''}
										/>
									</div>
								</div>
							</details>

							{err?.imports && (
								<div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
									{err.imports}
								</div>
							)}

							<button
								type="submit"
								className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
								disabled={isSubmitting}
							>
								{isSubmitting && (
									<svg
										className="mr-2 h-4 w-4 animate-spin"
										viewBox="0 0 24 24"
										fill="none"
										aria-hidden="true"
									>
										<circle
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
											opacity="0.25"
										/>
										<path
											d="M22 12a10 10 0 0 1-10 10"
											stroke="currentColor"
											strokeWidth="4"
											strokeLinecap="round"
										/>
									</svg>
								)}
								{isSubmitting ? 'Generating…' : 'Generate outreach'}
							</button>
						</Form>
					</div>
				</div>

				{/* Output */}
				<div className="md:col-span-2">
					<div className="sticky top-6">
						<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
							<h2 className="text-lg font-medium">Preview</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								Email subject lines, email body, LinkedIn DM, connection note,
								and a follow-up you can send.
							</p>

							{!success && !isSubmitting && (
								<div className="mt-6 space-y-4 text-sm text-muted-foreground">
									<div className="rounded-md border border-border bg-muted p-4">
										<div className="font-medium text-foreground">
											How it works
										</div>
										<ul className="mt-2 list-disc pl-5">
											<li>Paste the JD and your resume (or upload .txt).</li>
											<li>Add the recruiter or hiring manager’s name.</li>
											<li>
												Click{' '}
												<span className="font-medium">Generate outreach</span>{' '}
												to get messages tailored to the role.
											</li>
										</ul>
									</div>
									<div className="rounded-md border border-border bg-muted p-4">
										<div className="font-medium text-foreground">
											Why it helps
										</div>
										<ul className="mt-2 list-disc pl-5">
											<li>Personalized messaging beats cold applications.</li>
											<li>Multiple options so you can choose your voice.</li>
											<li>Copy in one click and send anywhere.</li>
										</ul>
									</div>
								</div>
							)}

							{isSubmitting && (
								<div className="mt-6 animate-pulse space-y-3">
									<div className="h-4 w-2/3 rounded bg-muted" />
									<div className="h-4 w-full rounded bg-muted" />
									<div className="h-24 w-full rounded bg-muted" />
								</div>
							)}

							{success && (
								<div className="mt-6 space-y-6 text-sm">
									{/* Subjects */}
									<section>
										<div className="mb-2 flex items-center justify-between">
											<h3 className="font-semibold">Email subjects</h3>
										</div>
										{success.outreach?.email?.subjects?.length ? (
											<ul className="list-disc pl-5">
												{success.outreach.email.subjects.map((s, i) => (
													<li
														key={i}
														className="mb-1 flex items-start justify-between gap-3"
													>
														<span>{s}</span>
														<CopyButton text={s} />
													</li>
												))}
											</ul>
										) : (
											<p className="text-muted-foreground">
												No subject suggestions returned.
											</p>
										)}
									</section>

									{/* Email body */}
									<section>
										<div className="mb-2 flex items-center justify-between">
											<h3 className="font-semibold">Email body</h3>
											<CopyButton text={success.outreach?.email?.body} />
										</div>
										<p className="whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-foreground">
											{success.outreach?.email?.body || '—'}
										</p>
									</section>

									{/* LinkedIn DM */}
									<section>
										<div className="mb-2 flex items-center justify-between">
											<h3 className="font-semibold">LinkedIn DM</h3>
											<CopyButton text={success.outreach?.linkedinDM?.body} />
										</div>
										<p className="whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-foreground">
											{success.outreach?.linkedinDM?.body || '—'}
										</p>
									</section>

									{/* Connection note */}
									<section>
										<div className="mb-2 flex items-center justify-between">
											<h3 className="font-semibold">Connection note</h3>
											<CopyButton
												text={success.outreach?.connectionNote?.body}
											/>
										</div>
										<p className="whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-foreground">
											{success.outreach?.connectionNote?.body || '—'}
										</p>
									</section>

									{/* Follow up */}
									<section>
										<div className="mb-2 flex items-center justify-between">
											<h3 className="font-semibold">Follow-up</h3>
											<CopyButton text={success.outreach?.followUp?.body} />
										</div>
										<p className="whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-foreground">
											{success.outreach?.followUp?.body || '—'}
										</p>
									</section>
								</div>
							)}
						</div>
					</div>
				</div>
			</main>
		</div>
	)
}
