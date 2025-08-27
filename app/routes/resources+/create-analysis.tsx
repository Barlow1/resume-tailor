import { json, type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '../../utils/db.server.ts'
import { requireUserId } from '../../utils/auth.server.ts' // or getUserId + 401

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request).catch(() => null)
  if (!userId) {
    return json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const resumeTxt = String(body.resumeTxt || '')

  // NOTE: do NOT gate saving with subscription/paywall
  const created = await prisma.analysis.create({
    data: { resumeTxt }, // no ownerId field in your schema
    select: { id: true },
  })

  return json(created)
}
