import { json, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { authenticator, requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
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

enum GenerateStep {
	EDIT = 'EDIT',
	ADD_JOB = 'ADD_JOB',
}

export default function Generate() {
	const { resume, gettingStartedProgress } =
		useLoaderData<typeof loader>()

	let step = GenerateStep.EDIT

	if (gettingStartedProgress?.hasSavedResume) {
		step = GenerateStep.ADD_JOB
	}

	const GenerateBody = () => {
		switch (step) {
			case GenerateStep.EDIT:
				return <ResumeEditor resume={resume} />
			case GenerateStep.ADD_JOB:
				return <JobEditor redirectTo={`generate`} />
			default:
				return <JobEditor />
		}
	}

	return (
		<>
			<div className="w-full">{GenerateBody()}</div>
		</>
	)
}
