import { Env } from '../../types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/gsc_session=([^;]+)/);

  if (match) {
    const sessionId = match[1];
    try {
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    } catch (e) {
      console.error('Error deleting session', e);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'gsc_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
    }
  });
};
