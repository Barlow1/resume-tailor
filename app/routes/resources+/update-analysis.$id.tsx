// app/routes/resources+/analysis.update.$id.tsx
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { prisma } from '../../utils/db.server.ts';
import { getAiFeedback } from '../../lib/careerfit.server.ts';

type Body = { title?: string; company?: string; jdText?: string; resumeTxt?: string };

export async function action({ params, request }: ActionFunctionArgs) {
  if (request.method !== 'PATCH') return json({ error: 'Method Not Allowed' }, { status: 405 });

  const id = params.id!;
  const body = (await request.json().catch(() => ({}))) as Body;

  const existing = await prisma.analysis.findUnique({ where: { id } });
  if (!existing) return json({ error: 'Not found' }, { status: 404 });

  const title = body.title ?? existing.title;
  const company = body.company ?? existing.company;
  const jdText = body.jdText ?? existing.jdText;
  const resumeTxt = body.resumeTxt ?? existing.resumeTxt;

  const feedback = await getAiFeedback(jdText, resumeTxt, title, company);

  const updated = await prisma.analysis.update({
    where: { id },
    data: {
      title,
      company,
      jdText,
      resumeTxt,
      fitPct: feedback.fitPct,
      feedback: JSON.stringify(feedback),
    },
  });

  return json({
    ...updated,
    feedback,
    people: updated.peopleJson ? JSON.parse(updated.peopleJson) : [],
  });
}