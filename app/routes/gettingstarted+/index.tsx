import { type DataFunctionArgs } from '@remix-run/node'
import { Link, useFetcher } from '@remix-run/react'
import { getUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { useOptionalUser } from '~/utils/user.ts'

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

export default function GettingStarted() {
	const user = useOptionalUser()
	const resetStepperFetcher = useFetcher()
	if (!user) {
		return <></>
	}

	const options = [
		{
			icon: (
				<svg
					className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
					fill="currentColor"
					viewBox="0 0 20 16"
				>
					<path d="M18 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2ZM6.5 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3.014 13.021l.157-.625A3.427 3.427 0 0 1 6.5 9.571a3.426 3.426 0 0 1 3.322 2.805l.159.622-6.967.023ZM16 12h-3a1 1 0 0 1 0-2h3a1 1 0 0 1 0 2Zm0-3h-3a1 1 0 1 1 0-2h3a1 1 0 1 1 0 2Zm0-3h-3a1 1 0 1 1 0-2h3a1 1 0 1 1 0 2Z" />
				</svg>
			),
			title: 'Tailor my existing resume',
			description:
				'My resume is fantastic, I just need to make minor changes to better fit the job description.',
			link: 'tailor',
		},
		{
			icon: (
				<svg
					className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
					fill="currentColor"
					viewBox="0 0 18 20"
				>
					<path d="M16 1h-3.278A1.992 1.992 0 0 0 11 0H7a1.993 1.993 0 0 0-1.722 1H2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2Zm-3 14H5a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2Zm0-4H5a1 1 0 0 1 0-2h8a1 1 0 1 1 0 2Zm0-5H5a1 1 0 0 1 0-2h2V2h4v2h2a1 1 0 1 1 0 2Z" />
				</svg>
			),
			title: 'Generate more bullet points',
			description:
				'My resume is good, but I could use some more bullet points.',
			link: 'upload-generate',
		},
		{
			icon: (
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					className="h-5 w-5 text-gray-500 dark:text-gray-400 text-bold"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 4.5v15m7.5-7.5h-15"
					/>
				</svg>
			),
			title: 'Start from scratch',
			description:
				"My resume hasn't been landing interviews, I want to create a new one from scratch.",
			link: 'generate',
		},
	]

	return (
		<>
			<div className="w-full">
				<resetStepperFetcher.Form
					method="post"
					action="/resources/onboarding-stepper"
					preventScrollReset
				>
					<div className="w-full">
						<h5 className="text-xl font-semibold uppercase text-gray-500 dark:text-gray-400">
							How would you like to get started?
						</h5>
						<div className="grid grid-cols-1 gap-3 py-8 md:grid-cols-3">
							{options.map(option => (
								<Link key={option.title} to={option.link}>
									<div className="space-y-4 rounded-lg border border-primary p-5 text-center hover:bg-secondary">
										<span className="dark:bg-night-400 ml-auto mr-auto flex h-8 w-8 items-center justify-center rounded-full bg-accent ring-4 ring-white dark:ring-gray-900">
											{option.icon}
										</span>
										<h4 className="text-md font-semibold text-primary">
											{option.title}
										</h4>
										<p className="text-sm">{option.description}</p>
									</div>
								</Link>
							))}
						</div>
					</div>
				</resetStepperFetcher.Form>
			</div>
		</>
	)
}
