import { Env, UserSession } from '../types';

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';

export const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'openid',
  'email',
  'profile'
].join(' ');

export function getRedirectUri(request: Request, env?: Env): string {
  if (env?.REDIRECT_URI) {
    return env.REDIRECT_URI;
  }
  const url = new URL(request.url);
  return `${url.origin}/api/auth/callback`;
}

export function buildAuthUrl(clientId: string, redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GSC_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    ...(state ? { state } : {})
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange code: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    id_token?: string;
  }>;
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  return response.json();
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  return response.json() as Promise<{
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  }>;
}

export async function getSession(request: Request, env: Env): Promise<UserSession | null> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...v] = c.trim().split('=');
      return [key, decodeURIComponent(v.join('='))];
    })
  );

  const sessionId = cookies['gsc_session'];
  if (!sessionId) return null;

  try {
    const session = await env.DB.prepare(
      'SELECT * FROM sessions WHERE id = ?'
    ).bind(sessionId).first<UserSession>();

    if (!session) return null;

    // Check if token expired and refresh if possible
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at < now + 60 && session.refresh_token && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      try {
        const refreshed = await refreshAccessToken(
          session.refresh_token,
          env.GOOGLE_CLIENT_ID,
          env.GOOGLE_CLIENT_SECRET
        );
        const newExpiresAt = now + refreshed.expires_in;
        await env.DB.prepare(
          'UPDATE sessions SET access_token = ?, expires_at = ? WHERE id = ?'
        ).bind(refreshed.access_token, newExpiresAt, sessionId).run();
        session.access_token = refreshed.access_token;
        session.expires_at = newExpiresAt;
      } catch (err) {
        console.error('Failed to auto-refresh session token', err);
      }
    }

    return session;
  } catch (err) {
    console.error('Database session lookup error', err);
    return null;
  }
}
