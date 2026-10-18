import { Env } from '../../types';

export const onRequestPatch: PagesFunction<Env> = async ({ request, params, env }) => {
  try {
    const rawSiteUrl = params.siteUrl as string;
    const siteUrl = decodeURIComponent(rawSiteUrl);
    const body = await request.json() as {
      category_id?: string | null;
      display_name?: string;
      is_favorite?: number;
    };

    if (body.category_id !== undefined) {
      await env.DB.prepare('UPDATE properties SET category_id = ? WHERE site_url = ?')
        .bind(body.category_id, siteUrl).run();
    }

    if (body.display_name !== undefined) {
      await env.DB.prepare('UPDATE properties SET display_name = ? WHERE site_url = ?')
        .bind(body.display_name, siteUrl).run();
    }

    if (body.is_favorite !== undefined) {
      await env.DB.prepare('UPDATE properties SET is_favorite = ? WHERE site_url = ?')
        .bind(body.is_favorite, siteUrl).run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  try {
    const rawSiteUrl = params.siteUrl as string;
    const siteUrl = decodeURIComponent(rawSiteUrl);

    await env.DB.prepare('DELETE FROM properties WHERE site_url = ?').bind(siteUrl).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
