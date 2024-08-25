import { json, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { authenticator, requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import ResumeUploader from '../../resources+/upload-resume.tsx'
import { ResumeEditor } from '../../resources+/resume-editor.tsx'
import { JobEditor } from '../../resources+/job-editor.tsx'

export async function loader({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const userPromise = prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, username: true },
	})
	const resumePromise = prisma.resume.findFirst({
		where: { ownerId: userId },
		include: { file: true, experience: true, education: true, skills: true },
	})
	const gettingStartedProgressPromise =
		prisma.gettingStartedProgress.findUnique({
			where: {
				ownerId: userId,
			},
		})

	const [user, resume, gettingStartedProgress] = await Promise.all([
		userPromise,
		resumePromise,
		gettingStartedProgressPromise,
	])
	if (!user) {
		throw await authenticator.logout(request, { redirectTo: '/' })
	}
	return json({ user, resume, gettingStartedProgress })
}

enum TailorStep {
	UPLOAD = 'UPLOAD',
	EDIT = 'EDIT',
	ADD_JOB = 'ADD_JOB',
	TAILOR = 'TAILOR',
}

export default function Tailor() {
	const { user, resume, gettingStartedProgress } =
		useLoaderData<typeof loader>()

	let step = TailorStep.UPLOAD

	if (resume && !gettingStartedProgress?.hasSavedResume) {
		step = TailorStep.EDIT
	} else if (gettingStartedProgress?.hasSavedResume) {
		step = TailorStep.ADD_JOB
	} else if (gettingStartedProgress?.hasSavedJob) {
		step = TailorStep.TAILOR
	}

	const TailorBody = () => {
		switch (step) {
			case TailorStep.UPLOAD:
				return <ResumeUploader user={user} resume={resume} />
			case TailorStep.EDIT:
				return <ResumeEditor resume={resume} />
			case TailorStep.ADD_JOB:
				return <JobEditor redirectTo={`tailor`} />
			case TailorStep.TAILOR:
				return <JobEditor redirectTo={`tailor`} />
			default:
				return <JobEditor />
		}
	}

	return (
		<>
			<div className="w-full">{TailorBody()}</div>
		</>
	)
}
