import type { LoaderFunctionArgs as LoaderArgs } from "@remix-run/node";
import { authenticator, KNOWN_AUTH_PROVIDERS } from "~/utils/auth.server.ts";
import { invariantResponse } from "~/utils/misc.ts";
import { getSession } from "~/utils/session.server.ts";

export const loader = async ({ request, params }: LoaderArgs) => {
  const baseUrl = new URL(request.url).origin;
  invariantResponse(
    params.provider && KNOWN_AUTH_PROVIDERS.includes(params.provider),
    "Unknown auth provider",
    { status: 404 },
  );
  const session = await getSession(request.headers.get('cookie'))
  const returnTo = session.get('redirectTo')
  session.unset('redirectTo');
  await authenticator.authenticate(params.provider, request, {
    successRedirect: returnTo ?? "/",
    context: {
      baseUrl
    }
  });

  return null;
};
