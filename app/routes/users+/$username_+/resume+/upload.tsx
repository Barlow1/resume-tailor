import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	type DataFunctionArgs,
	json,
	redirect,
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
} from '@remix-run/node'
import {
	Form,
	Outlet,
	useActionData,
	useFetcher,
	useLoaderData,
	useNavigation,
} from '@remix-run/react'
import { useReducer } from 'react'
import { z } from 'zod'
import { ErrorList } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import * as deleteFileRoute from '~/routes/resources+/delete-file.tsx'
import { authenticator, requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { parseResumeWithOpenAI } from '~/utils/openai-resume-parser.server.ts'
import { bytesToMB, invariant } from '~/utils/misc.ts'

const MAX_SIZE = 1024 * 1024 * 10 // 10MB

const NOT_FOUND = ''

function parseLocation(location: string): {
	city: string
	state: string
	country: string
} {
	if (!location) return { city: '', state: '', country: '' }
	const parts = location.split(',').map(p => p.trim())
	return {
		city: parts[0] || '',
		state: parts[1] || '',
		country: parts[2] || '',
	}
}

/*
The preprocess call is needed because a current bug in @remix-run/web-fetch
for more info see the bug (https://github.com/remix-run/web-std-io/pull/28)
and the explanation here: https://conform.guide/file-upload
*/
const ResumeFormSchema = z.object({
	resumeFile: z.preprocess(
		value => (value === '' ? new File([], '') : value),
		z
			.instanceof(File)
			.refine(file => file.name !== '' && file.size !== 0, 'File is required')
			.refine(file => {
				return file.size <= MAX_SIZE
			}, 'File size must be less than 10MB'),
	),
	resumeId: z.string().optional(),
})

export async function loader({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const userPromise = prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, username: true },
	})
	const resumePromise = prisma.resume.findFirst({
		where: { ownerId: userId },
		include: { file: true },
	})

	const [user, resume] = await Promise.all([userPromise, resumePromise])
	if (!user) {
		throw await authenticator.logout(request, { redirectTo: '/' })
	}
	return json({ user, resume })
}

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await unstable_parseMultipartFormData(
		request,
		unstable_createMemoryUploadHandler({ maxPartSize: MAX_SIZE }),
	)

	const submission = parse(formData, { schema: ResumeFormSchema })

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
	const { resumeFile, resumeId } = submission.value

	if (!(resumeFile instanceof File)) {
		return json(
			{
				status: 'error',
				submission,
				error: 'Invalid file upload. Please try again.',
			} as const,
			{ status: 400 },
		)
	}

	try {
		const buffer = Buffer.from(await resumeFile.arrayBuffer())
		const newPrismaResume = { blob: buffer }

		const parsedResume = await parseResumeWithOpenAI(resumeFile)

		const location = parseLocation(parsedResume.personal_info.location)

		// Handle case where user has no existing resume (first-time upload)
		const existingResumeId = resumeId || undefined
		const previousUserResume = existingResumeId
			? await prisma.resume.findUnique({
					where: { id: existingResumeId },
					select: { fileId: true },
				})
			: null

		if (existingResumeId) {
			// Update existing resume
			await prisma.resume.update({
				where: { id: existingResumeId },
				data: {
					title: parsedResume.experiences[0]?.title ?? NOT_FOUND,
					summary: parsedResume.summary ?? NOT_FOUND,
					phone: parsedResume.personal_info.phone ?? NOT_FOUND,
					email: parsedResume.personal_info.email ?? NOT_FOUND,
					firstName: parsedResume.personal_info.first_name ?? NOT_FOUND,
					lastName: parsedResume.personal_info.last_name ?? NOT_FOUND,
					city: location.city,
					state: location.state,
					country: location.country,
					experience: {
						deleteMany: {},
						create: parsedResume.experiences.map(ex => {
							const expLocation = parseLocation(ex.location || '')
							return {
								employer: ex.company ?? NOT_FOUND,
								role: ex.title ?? NOT_FOUND,
								startDate: ex.date_start,
								endDate: ex.date_end,
								city: expLocation.city,
								state: expLocation.state,
								country: expLocation.country,
								responsibilities: ex.bullet_points.join('\n'),
							}
						}),
					},
					education: {
						deleteMany: {},
						create: parsedResume.education.map(ed => {
							const edLocation = parseLocation(ed.location || '')
							return {
								school: ed.school ?? NOT_FOUND,
								field: ed.major
									? `${ed.degree} in ${ed.major}`
									: (ed.degree ?? NOT_FOUND),
								graduationDate: ed.date_end ? new Date(ed.date_end) : new Date(),
								city: edLocation.city,
								state: edLocation.state,
								country: edLocation.country,
								achievements: ed.honors?.join('\n') ?? '',
							}
						}),
					},
					skills: {
						deleteMany: {},
						create: parsedResume.skills.map(name => ({ name })),
					},
					file: {
						upsert: {
							update: newPrismaResume,
							create: newPrismaResume,
						},
					},
				},
			})
		} else {
			// Create new resume for first-time users
			await prisma.resume.create({
				data: {
					owner: { connect: { id: userId } },
					title: parsedResume.experiences[0]?.title ?? NOT_FOUND,
					summary: parsedResume.summary ?? NOT_FOUND,
					phone: parsedResume.personal_info.phone ?? NOT_FOUND,
					email: parsedResume.personal_info.email ?? NOT_FOUND,
					firstName: parsedResume.personal_info.first_name ?? NOT_FOUND,
					lastName: parsedResume.personal_info.last_name ?? NOT_FOUND,
					city: location.city,
					state: location.state,
					country: location.country,
					experience: {
						create: parsedResume.experiences.map(ex => {
							const expLocation = parseLocation(ex.location || '')
							return {
								employer: ex.company ?? NOT_FOUND,
								role: ex.title ?? NOT_FOUND,
								startDate: ex.date_start,
								endDate: ex.date_end,
								city: expLocation.city,
								state: expLocation.state,
								country: expLocation.country,
								responsibilities: ex.bullet_points.join('\n'),
							}
						}),
					},
					education: {
						create: parsedResume.education.map(ed => {
							const edLocation = parseLocation(ed.location || '')
							return {
								school: ed.school ?? NOT_FOUND,
								field: ed.major
									? `${ed.degree} in ${ed.major}`
									: (ed.degree ?? NOT_FOUND),
								graduationDate: ed.date_end ? new Date(ed.date_end) : new Date(),
								city: edLocation.city,
								state: edLocation.state,
								country: edLocation.country,
								achievements: ed.honors?.join('\n') ?? '',
							}
						}),
					},
					skills: {
						create: parsedResume.skills.map(name => ({ name })),
					},
					file: {
						create: newPrismaResume,
					},
				},
			})
		}

		if (previousUserResume?.fileId) {
			void prisma.file
				.delete({ where: { id: previousUserResume.fileId } })
				.catch(() => {})
		}

		return redirect('../edit')
	} catch (error: any) {
		console.error('Resume parsing error:', error)
		return json(
			{
				status: 'error',
				submission,
				error: error.message || 'Failed to parse resume. Please try again.',
			} as const,
			{ status: 500 },
		)
	}
}

type FileReducerState = {
	newFileSrc?: string
	newFileName?: string
	newFilSize?: number
}

function newFileReducer(
	state: FileReducerState,
	action: {
		type: 'new' | 'reset'
		payload?: FileReducerState
	},
): FileReducerState {
	if (action.type === 'new') {
		invariant(action.payload, 'expected payload with new action')
		return {
			newFileSrc: action.payload.newFileSrc,
			newFileName: action.payload.newFileName,
			newFilSize: action.payload.newFilSize,
		}
	}
	if (action.type === 'reset') {
		return {
			newFileSrc: undefined,
			newFileName: undefined,
			newFilSize: undefined,
		}
	}
	throw Error('Unknown action.')
}

export default function FileUploaderModal() {
	const data = useLoaderData<typeof loader>()

	const [{ newFileSrc, newFileName, newFilSize }, dispatch] = useReducer(
		newFileReducer,
		{},
	)
	const deleteFileFetcher = useFetcher<typeof deleteFileRoute.action>()
	const actionData = useActionData<typeof action>()
	const [form, { resumeFile }] = useForm({
		id: 'profile-resume',
		constraint: getFieldsetConstraint(ResumeFormSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ResumeFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	const transition = useNavigation()

	// useEffect(() => {
	// 	function preventDefault(e: any) {
	// 		e = e || event
	// 		console.log(e)
	// 		if (e.target?.id != resumeFile.id) {
	// 			// check which element is our target
	// 			e.preventDefault()
	// 		}
	// 	}
	// 	window.addEventListener('dragover', preventDefault, false)
	// 	window.addEventListener('drop', preventDefault, false)

	// 	return () => {
	// 		window.removeEventListener('dragover', preventDefault)
	// 		window.removeEventListener('drop', preventDefault)
	// 	}
	// }, [])

	function handleFileUpload(file: File) {
		if (file) {
			const reader = new FileReader()
			reader.onload = event => {
				dispatch({
					type: 'new',
					payload: {
						newFileSrc: event.target?.result?.toString() ?? '',
						newFileName: file.name,
						newFilSize: file.size,
					},
				})
			}
			reader.readAsDataURL(file)
		}
	}

	function handleOnChange(e: any) {
		e.preventDefault()
		const file = e.currentTarget.files?.[0]
		handleFileUpload(file)
	}

	function handleOnDrop(e: any) {
		e.preventDefault()
		let file
		if (e.dataTransfer.items) {
			const item = e.dataTransfer.items[0]
			if (item.kind === 'file') {
				file = item.getAsFile()
			}
		} else {
			file = e.dataTransfer.files[0]
		}
		handleFileUpload(file)
	}

	function dragOverHandler(e: any) {
		// Prevent default behavior (Prevent file from being opened)
		e.preventDefault()
	}

	const deleteProfileResumeFormId = 'delete-profile-resume'
	return (
		<>
			<>
				<h2 className="text-h2">Upload Resume</h2>
				<p className="text-sm">
					Upload your resume for copy-paste tailoring to jobs. If you want to
					use the builder, upload your resume from the builder instead.
				</p>
				<Form
					method="POST"
					encType="multipart/form-data"
					className="mt-8 flex flex-col items-center justify-center gap-10"
					onReset={() => dispatch({ type: 'reset' })}
					{...form.props}
				>
					<ErrorList errors={resumeFile.errors} id={resumeFile.errorId} />

					{actionData && 'error' in actionData && actionData.error ? (
						<div className="w-full rounded-md bg-red-50 p-4 dark:bg-red-900/20">
							<p className="text-sm text-red-700 dark:text-red-400">
								{String(actionData.error)}
							</p>
						</div>
					) : null}

					<div className="flex w-full items-center justify-center">
						<label
							htmlFor={resumeFile.id}
							className="dark:hover:bg-bray-800 flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600"
						>
							<div
								className="flex flex-col items-center justify-center pb-6 pt-5"
								onDrop={handleOnDrop}
								onDragOver={dragOverHandler}
							>
								{newFileSrc ? (
									<>
										<p>{newFileName}</p>
										<p>{bytesToMB(newFilSize ?? 0)} MB</p>
									</>
								) : (
									<>
										<svg
											aria-hidden="true"
											className="mb-3 h-10 w-10 text-gray-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
											></path>
										</svg>
										<p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
											<span className="font-semibold">Click to upload</span> or
											drag and drop
										</p>
										<p className="text-xs text-gray-500 dark:text-gray-400">
											PDF or DOCX (MAX. 10MB)
										</p>
									</>
								)}
							</div>
							<input
								{...conform.input(resumeFile, { type: 'file' })}
								type="file"
								accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
								className="sr-only"
								tabIndex={newFileSrc ? -1 : 0}
								onChange={handleOnChange}
							/>{' '}
						</label>
					</div>
					<input hidden readOnly name="resumeId" value={data.resume?.id} />
					{newFileSrc ? (
						<div className="flex gap-4">
							<Button
								type="submit"
								disabled={transition.state === 'submitting'}
								status={
									transition.state === 'submitting'
										? 'pending'
										: actionData?.status ?? 'idle'
								}
							>
								{transition.state === 'submitting'
									? 'Parsing...'
									: actionData?.status ?? 'Save Resume'}
							</Button>
							<Button type="reset" variant="secondary">
								Reset
							</Button>
						</div>
					) : (
						<div className="flex gap-4">
							{data.resume?.fileId ? (
								<Button
									variant="secondary"
									type="submit"
									form={deleteProfileResumeFormId}
								>
									🗑 Delete
								</Button>
							) : null}
						</div>
					)}
					<ErrorList errors={form.errors} />
				</Form>
				<deleteFileFetcher.Form
					method="POST"
					id={deleteProfileResumeFormId}
					action={deleteFileRoute.ROUTE_PATH}
				>
					<input readOnly hidden name="intent" value="submit" />
					<input
						readOnly
						name="fileId"
						type="hidden"
						value={data.resume?.fileId ?? ''}
					/>
				</deleteFileFetcher.Form>
			</>

			<Outlet />
		</>
	)
}
