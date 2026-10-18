import { Env } from '../../types';
import { getSession } from '../../utils/google';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const session = await getSession(request, env);

  if (!session) {
    return new Response(
      JSON.stringify({
        authenticated: false,
        user: null,
        configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      user: {
        email: session.user_email,
        name: session.user_name || session.user_email,
        picture: session.user_picture
      },
      configured: true
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
