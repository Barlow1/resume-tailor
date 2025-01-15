import { json, type ActionFunctionArgs } from '@remix-run/node'
import { getUserId } from '~/utils/auth.server.ts'
import { createJob } from '~/utils/job.server.ts'

export async function action({ request }: ActionFunctionArgs) {
  const userId = await getUserId(request)

  const formData = await request.formData()
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  const job = await createJob({ userId, title, content })
  return json({ success: true, job })
} 