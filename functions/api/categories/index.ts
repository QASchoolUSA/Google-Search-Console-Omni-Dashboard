import { Env } from '../../types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        c.id, 
        c.name, 
        c.color, 
        c.description, 
        c.icon,
        COUNT(p.id) as site_count
      FROM categories c
      LEFT JOIN properties p ON p.category_id = c.id
      GROUP BY c.id, c.name, c.color, c.description, c.icon
      ORDER BY c.name ASC
    `).all();

    return new Response(JSON.stringify(results || []), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json() as {
      name: string;
      color?: string;
      description?: string;
      icon?: string;
    };

    if (!body.name || !body.name.trim()) {
      return new Response(JSON.stringify({ error: 'Category name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = crypto.randomUUID();
    const color = body.color || '#6366f1';
    const description = body.description || '';
    const icon = body.icon || 'folder';

    await env.DB.prepare(`
      INSERT INTO categories (id, name, color, description, icon)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, body.name.trim(), color, description, icon).run();

    return new Response(JSON.stringify({ id, name: body.name.trim(), color, description, icon, site_count: 0 }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json() as {
      id: string;
      name: string;
      color?: string;
      description?: string;
    };

    if (!body.id || !body.name) {
      return new Response(JSON.stringify({ error: 'ID and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare(`
      UPDATE categories
      SET name = ?, color = COALESCE(?, color), description = COALESCE(?, description)
      WHERE id = ?
    `).bind(body.name.trim(), body.color || null, body.description || null, body.id).run();

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

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Unassign sites first
    await env.DB.prepare('UPDATE properties SET category_id = NULL WHERE category_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();

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
