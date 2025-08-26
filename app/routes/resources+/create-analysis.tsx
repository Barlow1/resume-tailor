import { json, type ActionFunctionArgs } from '@remix-run/node';
import { prisma } from '../../utils/db.server.ts';
import { getAiFeedback, findPeople } from '../../lib/careerfit.server.ts';

type Body = { title?: string; company?: string; jdText?: string; resumeTxt?: string };

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, { status: 405 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const { title = '', company = '', jdText = '', resumeTxt = '' } = body;

  // 1) create
  const base = await prisma.analysis.create({ data: { title, company, jdText, resumeTxt } });

  // 2) optional AI
  let feedback: any = null;
  let people: any[] = [];
  if (resumeTxt && jdText) {
    feedback = await getAiFeedback(jdText, resumeTxt, title, company);
    people = await findPeople(company, title);
  }

  // 3) persist
  const updated = await prisma.analysis.update({
    where: { id: base.id },
    data: feedback
      ? { fitPct: feedback.fitPct, feedback: JSON.stringify(feedback), peopleJson: JSON.stringify(people) }
      : {},
  });

  return json({
    ...updated,
    feedback: updated.feedback ? JSON.parse(updated.feedback) : null,
    people: updated.peopleJson ? JSON.parse(updated.peopleJson) : [],
  });
}