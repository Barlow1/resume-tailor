import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { createJob } from '~/utils/job.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { trackJobCreated } from '~/lib/analytics.server.ts'
import { trackUserActivity } from '~/lib/retention.server.ts'

export async function action({ request }: ActionFunctionArgs) {
  const userId = await getUserId(request)

  const formData = await request.formData()
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  // Get job count BEFORE creating (for accurate job_number)
  let jobNumber = 1
  if (userId) {
    const existingJobCount = await prisma.job.count({ where: { ownerId: userId } })
    jobNumber = existingJobCount + 1
  }

  const job = await createJob({ userId, title, content })

  // Track job created in PostHog with job_number for multi-job analysis
  if (userId) {
    const company = content.match(/company[:\s]+([^\n]+)/i)?.[1]?.trim()
    trackJobCreated(userId, 'manual', job.id, !!company, request, jobNumber)

    // Track return visit if applicable
    await trackUserActivity({ userId, trigger: 'job_created', request })
  }

  // Track onboarding progress - mark job as saved
  if (userId) {
    await prisma.gettingStartedProgress.upsert({
      where: { ownerId: userId },
      update: { hasSavedJob: true },
      create: {
        ownerId: userId,
        hasSavedResume: false,
        hasSavedJob: true,
        hasTailoredResume: false,
        hasGeneratedResume: false,
      },
    })
  }

  return json({ success: true, job })
}
