import { type GettingStartedProgress, type Job } from '@prisma/client'
import * as Dialog from '@radix-ui/react-dialog'
import { type DataFunctionArgs } from '@remix-run/node'
import { Link, useFetcher } from '@remix-run/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button.tsx'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { type Stringify } from '~/utils/misc.ts'
import { useOptionalUser } from '~/utils/user.ts'

function GreenCheckCircle() {
	return (
		<span className="absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full bg-green-200 ring-4 ring-white dark:bg-green-900 dark:ring-gray-900">
			<svg
				className="h-3.5 w-3.5 text-green-500 dark:text-green-400"
				aria-hidden="true"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 16 12"
			>
				<path
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M1 5.917 5.724 10.5 15 1.5"
				/>
			</svg>
		</span>
	)
}

export async function action({ request }: DataFunctionArgs) {
	const userId = await getUserId(request)
	if (userId) {
		await prisma.gettingStartedProgress.deleteMany({
			where: {
				ownerId: userId,
			},
		})
	}
	return null
}

export default function OnboardingStepper({
	firstJob,
	gettingStartedProgress,
}: {
	firstJob: Stringify<Job> | null
	gettingStartedProgress: GettingStartedProgress | null
}) {
	const isGettingStartedCompleted =
		gettingStartedProgress?.hasSavedJob &&
		gettingStartedProgress.hasSavedResume &&
		(gettingStartedProgress.hasTailoredResume ||
			gettingStartedProgress.hasGeneratedResume)

	const [isVisible, setIsVisible] = useState(!isGettingStartedCompleted)
	function dismissModal() {
		setIsVisible(false)
	}
	const user = useOptionalUser()
	const resetStepperFetcher = useFetcher()
	if (!user) {
		return <></>
	}

	return (
		<>
			<div className="container flex justify-end">
				<resetStepperFetcher.Form
					method="post"
					action="/resources/onboarding-stepper"
					preventScrollReset
				>
					{isGettingStartedCompleted ? (
						<Button
							className="fixed bottom-10 right-10"
							type="submit"
							variant="secondary"
							onClick={() => setIsVisible(true)}
							data-drawer-target="drawer-navigation"
							data-drawer-show="drawer-navigation"
							aria-controls="drawer-navigation"
						>
							Reset getting started
						</Button>
					) : (
						<Button
							className="fixed bottom-10 right-10"
							type="button"
							variant="secondary"
							onClick={() => setIsVisible(true)}
							data-drawer-target="drawer-navigation"
							data-drawer-show="drawer-navigation"
							aria-controls="drawer-navigation"
						>
							Getting started
						</Button>
					)}
				</resetStepperFetcher.Form>
			</div>
			<Dialog.Root open={!isGettingStartedCompleted && isVisible}>
				<Dialog.Portal role="presentation">
					<Dialog.Overlay className="fixed inset-0 backdrop-blur-[2px]" />
					<Dialog.Content
						onEscapeKeyDown={dismissModal}
						onInteractOutside={dismissModal}
						onPointerDownOutside={dismissModal}
						className="fixed right-0 top-0 z-40 h-screen w-72 -translate-x-full transition-transform sm:translate-x-0"
					>
						<aside
							id="default-sidebar"
							className="fixed right-0 top-0 z-40 h-screen w-72 -translate-x-full transition-transform sm:translate-x-0"
							aria-label="Sidebar"
						>
							<div className="h-full overflow-y-auto bg-accent px-3 py-4">
								<h5
									id="drawer-navigation-label"
									className="text-base font-semibold uppercase text-gray-500 dark:text-gray-400"
								>
									Getting Started
								</h5>
								<button
									onClick={dismissModal}
									type="button"
									name="close"
									data-drawer-hide="drawer-navigation"
									aria-controls="drawer-navigation"
									className="absolute right-2.5 top-2.5 inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
								>
									<svg
										aria-hidden="true"
										className="h-5 w-5"
										fill="currentColor"
										viewBox="0 0 20 20"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											fill-rule="evenodd"
											d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
											clip-rule="evenodd"
										></path>
									</svg>
									<span className="sr-only">Close menu</span>
								</button>
								<div className="overflow-y-auto py-4">
									<ol
										onClick={dismissModal}
										className="dark:border-night-400 relative ml-5 border-l border-gray-500 dark:border-gray-200 text-gray-500 dark:text-gray-400"
									>
										<Link to={`/users/${user?.username}/jobs/new`}>
											<li className="mb-10 ml-6">
												{gettingStartedProgress?.hasSavedJob ? (
													<GreenCheckCircle />
												) : (
													<span className="dark:bg-night-400 absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent ring-4 ring-white dark:ring-gray-900">
														<svg
															xmlns="http://www.w3.org/2000/svg"
															height="1em"
															viewBox="0 0 512 512"
														>
															<path
																className="fill-gray-500 dark:fill-gray-400"
																d="M320 336c0 8.84-7.16 16-16 16h-96c-8.84 0-16-7.16-16-16v-48H0v144c0 25.6 22.4 48 48 48h416c25.6 0 48-22.4 48-48V288H320v48zm144-208h-80V80c0-25.6-22.4-48-48-48H176c-25.6 0-48 22.4-48 48v48H48c-25.6 0-48 22.4-48 48v80h512v-80c0-25.6-22.4-48-48-48zm-144 0H192V96h128v32z"
															/>
														</svg>
													</span>
												)}
												<h3 className="font-medium leading-tight">Jobs</h3>
												<p className="text-sm">
													Add the description of the job your applying to
												</p>
											</li>
										</Link>
										<Link to={`/users/${user?.username}/resume/upload`}>
											<li className="mb-10 ml-6">
												{gettingStartedProgress?.hasSavedResume ? (
													<GreenCheckCircle />
												) : (
													<span className="dark:bg-night-400 absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent ring-4 ring-white dark:ring-gray-900">
														<svg
															className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
															aria-hidden="true"
															xmlns="http://www.w3.org/2000/svg"
															fill="currentColor"
															viewBox="0 0 20 16"
														>
															<path d="M18 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2ZM6.5 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3.014 13.021l.157-.625A3.427 3.427 0 0 1 6.5 9.571a3.426 3.426 0 0 1 3.322 2.805l.159.622-6.967.023ZM16 12h-3a1 1 0 0 1 0-2h3a1 1 0 0 1 0 2Zm0-3h-3a1 1 0 1 1 0-2h3a1 1 0 1 1 0 2Zm0-3h-3a1 1 0 1 1 0-2h3a1 1 0 1 1 0 2Z" />
														</svg>
													</span>
												)}
												<h3 className="font-medium leading-tight">Resume</h3>
												<p className="text-sm">
													Upload or enter your resume information
												</p>
											</li>
										</Link>
										<Link
											to={
												firstJob?.id
													? `/users/${user?.username}/jobs/${firstJob?.id}/tailor`
													: ''
											}
										>
											<li className="mb-10 ml-6">
												{gettingStartedProgress?.hasTailoredResume ? (
													<GreenCheckCircle />
												) : (
													<span className="dark:bg-night-400 absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent ring-4 ring-white dark:ring-gray-900">
														<svg
															className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
															aria-hidden="true"
															xmlns="http://www.w3.org/2000/svg"
															fill="currentColor"
															viewBox="0 0 18 20"
														>
															<path d="M16 1h-3.278A1.992 1.992 0 0 0 11 0H7a1.993 1.993 0 0 0-1.722 1H2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2Zm-3 14H5a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2Zm0-4H5a1 1 0 0 1 0-2h8a1 1 0 1 1 0 2Zm0-5H5a1 1 0 0 1 0-2h2V2h4v2h2a1 1 0 1 1 0 2Z" />
														</svg>
													</span>
												)}
												<h3 className="font-medium leading-tight">Tailor</h3>
												<p className="text-sm">Tailor your resume</p>
											</li>
										</Link>
									</ol>
								</div>
							</div>
						</aside>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</>
	)
}
