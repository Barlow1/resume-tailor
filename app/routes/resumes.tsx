import {
	type ActionFunctionArgs,
	json,
	type LoaderFunctionArgs,
	redirect,
} from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import { getUserId } from '~/utils/auth.server.ts'
import { getUserBuilderResumes } from '~/utils/builder-resume.server.ts'
import { resumeCookie } from '~/utils/resume-cookie.server.ts'
import { Button } from '~/components/ui/button.tsx'
import { Icon } from '~/components/ui/icon.tsx'

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserId(request)
	if (!userId) {
		throw new Error('Not authenticated')
	}

	const resumes = await getUserBuilderResumes(userId)
	return json({ resumes })
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const resumeId = formData.get('resumeId')

	if (typeof resumeId !== 'string') {
		throw new Error('Invalid resume ID')
	}

	return redirect('/builder', {
		headers: {
			'Set-Cookie': await resumeCookie.serialize({
				resumeId,
				downloadPDFRequested: false,
				subscribe: false,
			}),
		},
	})
}

export default function ResumesPage() {
	const { resumes } = useLoaderData<typeof loader>()
	const fetcher = useFetcher()

	const handleResumeClick = (resumeId: string | null | undefined) => {
		if (!resumeId) {
			return
		}
		fetcher.submit(
			{ resumeId },
			{
				method: 'post',
				action: '/resumes',
			},
		)
	}

	const handleAddResume = () => {
		fetcher.submit(
			{ resumeId: null },
			{
				method: 'post',
				action: '/resumes',
			},
		)
	}

	return (
		<div className="container mx-auto py-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="text-2xl font-bold">My Resumes</h1>
				<Button onClick={handleAddResume} className="flex items-center gap-2">
					<Icon name="plus" size="sm" />
					Create New Resume
				</Button>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{resumes.map(resume => (
					<button
						key={resume.id}
						onClick={() => handleResumeClick(resume.id)}
						className="group relative flex flex-col rounded-lg border border-gray-200 p-4 transition hover:border-gray-300 hover:shadow-md"
					>
						<h2 className="mb-2 font-semibold">
							{resume.name || 'Untitled Resume'}
						</h2>
						<p className="text-sm text-gray-500">
							{resume.job?.title || 'No job specified'}
						</p>
						<div className="mt-4 text-sm text-gray-400">
							<span>
								Last edited: {resume.updatedAt ? new Date(resume.updatedAt).toLocaleDateString() : '-'}
							</span>
						</div>
						<Icon
							size="md"
							name="arrow-right"
							className="absolute bottom-4 right-4 opacity-0 transition group-hover:opacity-100"
						/>
					</button>
				))}

				{resumes.length === 0 && (
					<div className="col-span-full rounded-lg border border-dashed border-gray-200 p-8 text-center">
						<p className="text-gray-500">
							You haven't created any resumes yet.
						</p>
						<Button asChild className="mt-4">
							<Link to="/builder">Create your first resume</Link>
						</Button>
					</div>
				)}
			</div>
		</div>
	)
}
