import { type SerializeFrom } from '@remix-run/node'
import { useRouteLoaderData } from '@remix-run/react'
import { type loader as rootLoader } from '~/root.tsx'

export function useGettingStartedProgress() {
	const data = useRouteLoaderData('root') as SerializeFrom<typeof rootLoader>
	if (!data) {
		return undefined
	}
	const gettingStartedProgress = data.gettingStartedProgress
	return {
		isComplete:
			gettingStartedProgress?.hasSavedJob &&
			gettingStartedProgress.hasSavedResume &&
			(gettingStartedProgress.hasTailoredResume ||
				gettingStartedProgress.hasGeneratedResume),
		progress: gettingStartedProgress,
	}
}
