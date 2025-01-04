import type { LoaderFunctionArgs as LoaderArgs } from "@remix-run/node";
import { authenticator } from "~/utils/auth.server.ts";
import { invariantResponse } from "~/utils/misc.ts";

export const loader = async ({ request, params }: LoaderArgs) => {
  const baseUrl = new URL(request.url).origin;
  invariantResponse(params.provider, "provider is a required parameter");
  const returnTo = new URL(request.url).searchParams.get("returnTo");
  await authenticator.authenticate(params.provider, request, {
    successRedirect: returnTo ?? "/",
    context: {
      baseUrl
    }
  });

  return null;
};
