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

	const resumePromise = prisma.resume.findFirst({
		where: { ownerId: userId },
		include: { file: true, experience: true, education: true, skills: true },
	})
	const [gettingStartedProgress, resume] = await Promise.all([
		gettingStartedProgressPromise,
		resumePromise,
	])
	return json({ gettingStartedProgress, resume })
}

enum GenerateStep {
	UPLOAD = 'UPLOAD',
	EDIT = 'EDIT',
	ADD_JOB = 'ADD_JOB',
	GENERATE = 'GENERATE',
}

export default function GettingStartedLayout() {
	const { gettingStartedProgress, resume } = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	if (!user) {
		return <></>
	}

	let step = GenerateStep.UPLOAD

	if (resume && !gettingStartedProgress?.hasSavedResume) {
		step = GenerateStep.EDIT
	} else if (
		gettingStartedProgress?.hasSavedResume &&
		!gettingStartedProgress?.hasSavedJob
	) {
		step = GenerateStep.ADD_JOB
	} else if (gettingStartedProgress?.hasSavedJob) {
		step = GenerateStep.GENERATE
	}

	const steps = [
		{
			id: '01',
			name: 'Upload Resume',
			status: step === GenerateStep.UPLOAD ? 'current' : 'complete',
		},
		{
			id: '02',
			name: 'Edit Resume',
			status:
				step === GenerateStep.EDIT
					? 'current'
					: step === GenerateStep.ADD_JOB || step === GenerateStep.GENERATE
					? 'complete'
					: 'upcoming',
		},
		{
			id: '03',
			name: 'Add Job',
			status:
				step === GenerateStep.ADD_JOB
					? 'current'
					: step === GenerateStep.GENERATE
					? 'complete'
					: 'upcoming',
		},
		{ id: '04', name: 'Generate Experience', status: 'upcoming' },
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
