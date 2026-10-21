import { Env } from './functions/types';

// Import all API handlers directly
import { onRequestGet as authLogin } from './functions/api/auth/login';
import { onRequestGet as authCallback } from './functions/api/auth/callback';
import { onRequestGet as authMe } from './functions/api/auth/me';
import { onRequestPost as authLogout } from './functions/api/auth/logout';

import { 
  onRequestGet as getCategories, 
  onRequestPost as postCategory, 
  onRequestPut as putCategory, 
  onRequestDelete as deleteCategory 
} from './functions/api/categories/index';

import { 
  onRequestGet as getSites, 
  onRequestPost as postSites 
} from './functions/api/sites/index';

import { 
  onRequestPatch as patchSite, 
  onRequestDelete as deleteSite 
} from './functions/api/sites/[siteUrl]';

import { onRequestPost as syncGsc } from './functions/api/sync/index';
import { onRequestGet as getAggregateMetrics } from './functions/api/metrics/aggregate';
import { onRequestGet as getSiteMetrics } from './functions/api/metrics/[siteUrl]';
import { onRequestGet as getIndexingMetrics } from './functions/api/metrics/indexing';
import { onRequestGet as auditSite } from './functions/api/audit/[siteUrl]';

export interface WorkerEnv extends Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: WorkerEnv, executionCtx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Helper context for PagesFunction compatibility
    const makeContext = (params: Record<string, string | string[]> = {}) => ({
      request,
      functionPath: path,
      waitUntil: (p: Promise<any>) => executionCtx.waitUntil(p),
      next: () => env.ASSETS.fetch(request),
      env,
      params,
      data: {}
    });

    try {
      // 1. Auth routes
      if (path === '/api/auth/login' && method === 'GET') {
        return await authLogin(makeContext() as any);
      }
      if (path === '/api/auth/callback' && method === 'GET') {
        return await authCallback(makeContext() as any);
      }
      if (path === '/api/auth/me' && method === 'GET') {
        return await authMe(makeContext() as any);
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        return await authLogout(makeContext() as any);
      }

      // 2. Categories routes
      if (path === '/api/categories') {
        if (method === 'GET') return await getCategories(makeContext() as any);
        if (method === 'POST') return await postCategory(makeContext() as any);
        if (method === 'PUT') return await putCategory(makeContext() as any);
        if (method === 'DELETE') return await deleteCategory(makeContext() as any);
      }

      // 3. Sites routes
      if (path === '/api/sites') {
        if (method === 'GET') return await getSites(makeContext() as any);
        if (method === 'POST') return await postSites(makeContext() as any);
      }

      const siteMatch = path.match(/^\/api\/sites\/([^/]+)$/);
      if (siteMatch) {
        const siteUrl = decodeURIComponent(siteMatch[1]);
        if (method === 'PATCH') return await patchSite(makeContext({ siteUrl }) as any);
        if (method === 'DELETE') return await deleteSite(makeContext({ siteUrl }) as any);
      }

      // 4. Sync route
      if (path === '/api/sync' && method === 'POST') {
        return await syncGsc(makeContext() as any);
      }

      // 5. Metrics routes
      if (path === '/api/metrics/aggregate' && method === 'GET') {
        return await getAggregateMetrics(makeContext() as any);
      }

      if (path === '/api/metrics/indexing' && method === 'GET') {
        return await getIndexingMetrics(makeContext() as any);
      }

      const metricSiteMatch = path.match(/^\/api\/metrics\/([^/]+)$/);
      if (metricSiteMatch && method === 'GET') {
        const siteUrl = decodeURIComponent(metricSiteMatch[1]);
        return await getSiteMetrics(makeContext({ siteUrl }) as any);
      }

      // 6. Live Audit route (Side-by-side GSC Parity verification)
      const auditMatch = path.match(/^\/api\/audit\/([^/]+)$/);
      if (auditMatch && method === 'GET') {
        const siteUrl = decodeURIComponent(auditMatch[1]);
        return await auditSite(makeContext({ siteUrl }) as any);
      }

      // If it starts with /api/ and didn't match, return 404
      if (path.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Otherwise serve static frontend assets (SolidJS app)
      return await env.ASSETS.fetch(request);
    } catch (err: any) {
      console.error('Unhandled Worker error', err);
      return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
