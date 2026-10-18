import { Env } from '../../types';
import { buildAuthUrl, getRedirectUri } from '../../utils/google';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.GOOGLE_CLIENT_ID) {
    return new Response(
      JSON.stringify({
        error: 'GOOGLE_CLIENT_ID is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your Cloudflare Pages environment variables.'
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const redirectUri = getRedirectUri(request);
  const authUrl = buildAuthUrl(env.GOOGLE_CLIENT_ID, redirectUri);

  return Response.redirect(authUrl, 302);
};
