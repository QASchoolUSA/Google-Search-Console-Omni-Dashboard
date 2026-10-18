import { Env } from '../../types';
import { buildAuthUrl, getRedirectUri } from '../../utils/google';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.GOOGLE_CLIENT_ID) {
    const availableEnvKeys = Object.keys(env || {}).filter(k => k !== 'DB' && k !== 'ASSETS');
    return new Response(
      JSON.stringify({
        error: 'GOOGLE_CLIENT_ID is not configured.',
        instruction: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Secrets under Settings > Variables and Secrets in your Cloudflare Worker dashboard.',
        availableEnvKeys
      }, null, 2),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const redirectUri = getRedirectUri(request);
  const authUrl = buildAuthUrl(env.GOOGLE_CLIENT_ID, redirectUri);

  return Response.redirect(authUrl, 302);
};
