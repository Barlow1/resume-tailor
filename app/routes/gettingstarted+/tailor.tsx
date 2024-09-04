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

enum TailorStep {
	UPLOAD = 'UPLOAD',
	EDIT = 'EDIT',
	ADD_JOB = 'ADD_JOB',
	TAILOR = 'TAILOR',
}

export default function GettingStartedLayout() {
	const { gettingStartedProgress, resume } = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	if (!user) {
		return <></>
	}

	let step = TailorStep.UPLOAD

	if (resume && !gettingStartedProgress?.hasSavedResume) {
		step = TailorStep.EDIT
	} else if (gettingStartedProgress?.hasSavedResume) {
		step = TailorStep.ADD_JOB
	} else if (gettingStartedProgress?.hasSavedJob) {
		step = TailorStep.TAILOR
	}

	const steps = [
		{
			id: '01',
			name: 'Upload Resume',
			status: step === TailorStep.UPLOAD ? 'current' : 'complete',
		},
		{
			id: '02',
			name: 'Edit Resume',
			status:
				step === TailorStep.EDIT
					? 'current'
					: step === TailorStep.ADD_JOB || step === TailorStep.TAILOR
					? 'complete'
					: 'upcoming',
		},
		{
			id: '03',
			name: 'Add Job',
			status:
				step === TailorStep.ADD_JOB
					? 'current'
					: step === TailorStep.TAILOR
					? 'complete'
					: 'upcoming',
		},
		{ id: '04', name: 'Tailor Experience', status: 'upcoming' },
	]

	return (
		<>
			<div className="w-full pb-20">
				<Stepper steps={steps} />
				<Outlet />
			</div>
		</>
	)
}
