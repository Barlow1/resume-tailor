import { json, type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '../../utils/db.server.ts'
import { requireUserId } from '../../utils/auth.server.ts' // or getUserId + 401

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request).catch(() => null)
  if (!userId) {
    return json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    resumeTxt: string
    resumeData?: any
  }
  const resumeTxt = String(body.resumeTxt || '')
  const resumeData = body.resumeData || null

  // NOTE: do NOT gate saving with subscription/paywall
  const created = await prisma.analysis.create({
    data: {
      resumeTxt,
      resumeData: resumeData ? JSON.stringify(resumeData) : null,
    },
    select: { id: true },
  })

  return json(created)
}
