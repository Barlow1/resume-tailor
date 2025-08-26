import { json, type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '~/utils/db.server.ts'
import { requireUserId } from '~/utils/auth.server.ts'

type Body = { title?: string; company?: string; jdText?: string; resumeTxt?: string }

export async function action({ request }: ActionFunctionArgs) {
  // Must be signed in to create an analysis, but NO paywall here
  const userId = await requireUserId(request)

  const body = (await request.json().catch(() => ({}))) as Body
  const { title = '', company = '', jdText = '', resumeTxt = '' } = body

  // Create the analysis (your schema has no ownerId — we won’t add one)
  const created = await prisma.analysis.create({
    data: {
      title,
      company,
      jdText,
      resumeTxt,
    },
    select: { id: true, title: true, company: true, jdText: true, resumeTxt: true },
  })

  // You can still increment an existing counter somewhere else if you like,
  // but we won’t touch the DB shape here.

  return json(created, { status: 200 })
}
