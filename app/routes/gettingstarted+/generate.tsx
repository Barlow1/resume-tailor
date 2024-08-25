import { json, type DataFunctionArgs } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import Stepper from '~/components/stepper.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { useOptionalUser } from '~/utils/user.ts'

export async function loader({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const gettingStartedProgressPromise =
		prisma.gettingStartedProgress.findUnique({
			where: {
				ownerId: userId,
			},
		})

	const [gettingStartedProgress] = await Promise.all([
		gettingStartedProgressPromise,
	])
	return json({ gettingStartedProgress })
}

enum GenerateStep {
	EDIT = 'EDIT',
	ADD_JOB = 'ADD_JOB',
	GENERATE = 'GENERATE',
}

export default function GettingStartedLayout() {
	const { gettingStartedProgress } = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	if (!user) {
		return <></>
	}

	let step = GenerateStep.EDIT

	if (gettingStartedProgress?.hasSavedResume) {
		step = GenerateStep.ADD_JOB
	} else if (gettingStartedProgress?.hasSavedJob) {
		step = GenerateStep.GENERATE
	}

	const steps = [
		{
			id: '01',
			name: 'Enter Resume',
			status: step === GenerateStep.EDIT ? 'current' : 'complete',
		},
		{
			id: '02',
			name: 'Add Job',
			status:
				step === GenerateStep.ADD_JOB
					? 'current'
					: step === GenerateStep.GENERATE
					? 'complete'
					: 'upcoming',
		},
		{ id: '03', name: 'Generate Experience', status: 'upcoming' },
	]

	return (
		<>
			<div className="w-full">
				<Stepper steps={steps} />
				<Outlet />
			</div>
		</>
	)
}
