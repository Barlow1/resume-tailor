// app/routes/resources+/echo.ts
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  return json({ ok: true, where: 'loader', method: request.method, path: new URL(request.url).pathname });
}

export async function action({ request }: ActionFunctionArgs) {
  // This will be called for POST/PUT/PATCH/DELETE by default
  return json({ ok: true, where: 'action', method: request.method });
}
