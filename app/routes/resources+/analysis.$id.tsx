// app/routes/resources+/analysis.$id.tsx
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { prisma } from '../../utils/db.server.ts';

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.id!;
  const a = await prisma.analysis.findUnique({ where: { id } });
  if (!a) throw new Response('Not Found', { status: 404 });
  return json({
    ...a,
    feedback: a.feedback ? JSON.parse(a.feedback) : null,
    people: a.peopleJson ? JSON.parse(a.peopleJson) : [],
  });
}