import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import * as Dialog from '@radix-ui/react-dialog'
import {
	type DataFunctionArgs,
	json,
	redirect,
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
} from '@remix-run/node'
import {
	Form,
	Link,
	Outlet,
	useActionData,
	useFetcher,
	useLoaderData,
	useNavigate,
	useNavigation,
} from '@remix-run/react'
import { useReducer } from 'react'
import invariant from 'tiny-invariant'
import { z } from 'zod'
import * as deleteFileRoute from '~/routes/resources+/delete-file.tsx'
import { authenticator, requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { Button, ErrorList } from '~/utils/forms.tsx'
import { parseResume } from '~/utils/hrflowai.server.ts'
import { bytesToMB } from '~/utils/misc.ts'

const MAX_SIZE = 1024 * 1024 * 10 // 10MB

const NOT_FOUND = ''

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

	const buffer = Buffer.from(await resumeFile.arrayBuffer())

	const newPrismaResume = {
		blob: buffer,
	}

	invariant(resumeFile instanceof File, 'file not the right type')
	invariant(typeof resumeId === 'string', 'no resume id found')
	// Save the uploaded file to disk

	const parsedResume = await parseResume(resumeFile)
	console.log(JSON.stringify(parsedResume))

	const previousUserResume = await prisma.resume.findUnique({
		where: { id: resumeId },
		select: { fileId: true },
	})

	await prisma.resume.upsert({
		select: { id: true },
		where: { id: resumeId },
		update: {
			title: parsedResume.parsing.experiences[0]?.title ?? NOT_FOUND,
			summary: parsedResume.parsing.summary ?? NOT_FOUND,
			phone: parsedResume.parsing.phones[0] ?? NOT_FOUND,
			email: parsedResume.parsing.emails[0] ?? NOT_FOUND,
			firstName: parsedResume.profile.info.first_name ?? NOT_FOUND,
			lastName: parsedResume.profile.info.last_name ?? NOT_FOUND,
			city: parsedResume.profile.info.location.fields.city ?? NOT_FOUND,
			state: parsedResume.profile.info.location.fields.state ?? NOT_FOUND,
			country: parsedResume.profile.info.location.fields.country ?? NOT_FOUND,
			experience: {
				upsert: parsedResume.profile.experiences.map(ex => {
					return {
						where: {
							resumeEmployerRoleIdentifier: {
								resumeId,
								employer: ex.company,
								role: ex.title,
							},
						},
						update: {
							employer: ex.company ?? NOT_FOUND,
							role: ex.title ?? NOT_FOUND,
							startDate: new Date(ex.date_start),
							endDate: new Date(ex.date_end),
							city: ex.location.fields.city ?? NOT_FOUND,
							state: ex.location.fields.state ?? NOT_FOUND,
							country: ex.location.fields.country ?? NOT_FOUND,
							responsibilities: ex.tasks.map(t => t.name).join('\n'),
						},
						create: {
							employer: ex.company ?? NOT_FOUND,
							role: ex.title ?? NOT_FOUND,
							startDate: new Date(ex.date_start),
							endDate: new Date(ex.date_end),
							city: ex.location.fields.city ?? NOT_FOUND,
							state: ex.location.fields.state ?? NOT_FOUND,
							country: ex.location.fields.country ?? NOT_FOUND,
							responsibilities: ex.tasks.map(t => t.name).join('\n'),
						},
					}
				}),
				deleteMany: {
					resumeId: resumeId,
					NOT: parsedResume.profile.experiences.map(ex => {
						return {
							employer: ex.company,
							role: ex.title,
						}
					}),
				},
			},
			education: {
				upsert: parsedResume.profile.educations.map(ed => {
					return {
						where: {
							resumeSchoolFieldIdentifier: {
								resumeId,
								school: ed.school,
								field: ed.title,
							},
						},
						create: {
							school: ed.school ?? NOT_FOUND,
							field: ed.title ?? NOT_FOUND,
							graduationDate: new Date(ed.date_end),
							city: ed.location.fields.city ?? NOT_FOUND,
							state: ed.location.fields.state ?? NOT_FOUND,
							country: ed.location.fields.country ?? NOT_FOUND,
							achievements: ed.tasks.map(t => t.name).join('\n'),
						},
						update: {
							school: ed.school ?? NOT_FOUND,
							field: ed.title ?? NOT_FOUND,
							graduationDate: new Date(ed.date_end),
							city: ed.location.fields.city ?? NOT_FOUND,
							state: ed.location.fields.state ?? NOT_FOUND,
							country: ed.location.fields.country ?? NOT_FOUND,
							achievements: ed.tasks.map(t => t.name).join('\n'),
						},
					}
				}),
				deleteMany: {
					resumeId: resumeId,
					NOT: parsedResume.profile.educations.map(ed => {
						return {
							school: ed.school,
							field: ed.title,
						}
					}),
				},
			},
			skills: {
				upsert: parsedResume.profile.skills.map(sk => ({
					where: {
						resumeSkillIdentifier: {
							resumeId,
							name: sk.name,
						},
					},
					create: {
						name: sk.name,
					},
					update: {
						name: sk.name,
					},
				})),
				deleteMany: {
					resumeId: resumeId,
					NOT: parsedResume.profile.skills.map(sk => {
						return {
							name: sk.name,
						}
					}),
				},
			},
			file: {
				upsert: {
					update: newPrismaResume,
					create: newPrismaResume,
				},
			},
		},
		create: {
			owner: {
				connect: {
					id: userId,
				},
			},
			title: parsedResume.parsing.experiences[0]?.title ?? NOT_FOUND,
			summary: parsedResume.parsing.summary ?? NOT_FOUND,
			phone: parsedResume.parsing.phones[0] ?? NOT_FOUND,
			email: parsedResume.parsing.emails[0] ?? NOT_FOUND,
			firstName: parsedResume.profile.info.first_name ?? NOT_FOUND,
			lastName: parsedResume.profile.info.last_name ?? NOT_FOUND,
			city: parsedResume.profile.info.location.fields.city ?? NOT_FOUND,
			state: parsedResume.profile.info.location.fields.state ?? NOT_FOUND,
			country: parsedResume.profile.info.location.fields.country ?? NOT_FOUND,
			experience: {
				create: parsedResume.profile.experiences.map(ex => {
					return {
						employer: ex.company ?? NOT_FOUND,
						role: ex.title ?? NOT_FOUND,
						startDate: new Date(ex.date_start),
						endDate: new Date(ex.date_end),
						city: ex.location.fields.city ?? NOT_FOUND,
						state: ex.location.fields.state ?? NOT_FOUND,
						country: ex.location.fields.country ?? NOT_FOUND,
						responsibilities: ex.tasks.map(t => t.name).join('\n'),
					}
				}),
			},
			education: {
				create: parsedResume.profile.educations.map(ed => {
					return {
						school: ed.school ?? NOT_FOUND,
						field: ed.title ?? NOT_FOUND,
						graduationDate: new Date(ed.date_end),
						city: ed.location.fields.city ?? NOT_FOUND,
						state: ed.location.fields.state ?? NOT_FOUND,
						country: ed.location.fields.country ?? NOT_FOUND,
						achievements: ed.tasks.map(t => t.name).join('\n'),
					}
				}),
			},
			skills: {
				create: parsedResume.profile.skills.map(sk => ({
					name: sk.name,
				})),
			},
			file: {
				create: newPrismaResume,
			},
		},
	})

	if (previousUserResume?.fileId) {
		void prisma.file
			.delete({
				where: { id: previousUserResume.fileId },
			})
			.catch(() => {}) // ignore the error, maybe it never existed?
	}

	return redirect('../edit')
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
	const navigate = useNavigate()
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
	const dismissModal = () => navigate('..', { preventScrollReset: true })
	return (
		<>
			<Dialog.Root open={true}>
				<Dialog.Portal>
					<Dialog.Overlay className="fixed inset-0 backdrop-blur-[2px]" />
					<Dialog.Content
						onEscapeKeyDown={dismissModal}
						onInteractOutside={dismissModal}
						onPointerDownOutside={dismissModal}
						className="fixed left-1/2 top-1/2 w-[90vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-night-500 p-12 shadow-lg"
					>
						<Dialog.Title asChild className="text-center">
							<h2 className="text-h2">Upload Resume</h2>
						</Dialog.Title>
						<Form
							method="POST"
							encType="multipart/form-data"
							className="mt-8 flex flex-col items-center justify-center gap-10"
							onReset={() => dispatch({ type: 'reset' })}
							{...form.props}
						>
							<ErrorList errors={resumeFile.errors} id={resumeFile.errorId} />

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
													<span className="font-semibold">Click to upload</span>{' '}
													or drag and drop
												</p>
												<p className="text-xs text-gray-500 dark:text-gray-400">
													PDF, DOCX, PNG, or JPEG (MAX. 10MB)
												</p>
											</>
										)}
									</div>
									<input
										{...conform.input(resumeFile, { type: 'file' })}
										type="file"
										accept=".doc, .docx, application/msword,
										 application/vnd.openxmlformats-officedocument.wordprocessingml.document,
										 application/pdf, application/msword, image/png, image/jpeg"
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
										size="md"
										variant="primary"
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
									<Button type="reset" size="md" variant="secondary">
										Reset
									</Button>
								</div>
							) : (
								<div className="flex gap-4">
									{data.resume?.fileId ? (
										<Button
											size="md"
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
						<Dialog.Close asChild>
							<Link
								to=".."
								aria-label="Close"
								className="absolute right-10 top-10"
							>
								❌
							</Link>
						</Dialog.Close>
					</Dialog.Content>
				</Dialog.Portal>
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
			</Dialog.Root>
			<Outlet />
		</>
	)
}
