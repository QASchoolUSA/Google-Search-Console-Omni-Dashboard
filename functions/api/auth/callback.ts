import { Env } from '../../types';
import { exchangeCodeForTokens, fetchGoogleProfile, getRedirectUri } from '../../utils/google';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return new Response(
      `OAuth error: ${error || 'Missing authorization code'}. <a href="/">Return to Dashboard</a>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return new Response(
      'Google Client credentials not configured on server. <a href="/">Return to Dashboard</a>',
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }

  try {
    const redirectUri = getRedirectUri(request, env);
    const tokenData = await exchangeCodeForTokens(
      code,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const profile = await fetchGoogleProfile(tokenData.access_token);
    const userEmail = profile?.email || 'authenticated-user@gmail.com';
    const userName = profile?.name || 'GSC User';
    const userPicture = profile?.picture || '';

    const sessionId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

    // Store session in D1 database
    await env.DB.prepare(
      `INSERT OR REPLACE INTO sessions (id, user_email, user_name, user_picture, access_token, refresh_token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      sessionId,
      userEmail,
      userName,
      userPicture,
      tokenData.access_token,
      tokenData.refresh_token || null,
      expiresAt
    ).run();

    // 30 days cookie
    const isHttps = url.protocol === 'https:';
    const cookieFlags = [
      `gsc_session=${sessionId}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=2592000',
      isHttps ? 'Secure' : ''
    ].filter(Boolean).join('; ');

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/?auth=success',
        'Set-Cookie': cookieFlags
      }
    });
  } catch (err: any) {
    console.error('OAuth callback failed', err);
    return new Response(
      `Authentication failed: ${err.message}. <a href="/">Back to Dashboard</a>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
};
