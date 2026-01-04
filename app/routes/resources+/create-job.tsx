import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { createJob } from '~/utils/job.server.ts'
import { prisma } from '~/utils/db.server.ts'

export async function action({ request }: ActionFunctionArgs) {
  const userId = await getUserId(request)

  const formData = await request.formData()
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  const job = await createJob({ userId, title, content })

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
