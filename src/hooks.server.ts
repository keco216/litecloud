import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth';
import { isDavRequest, handleDav } from '$lib/server/webdav';
import { apiLimiter, uploadLimiter } from '$lib/server/ratelimit';

export const handle: Handle = async ({ event, resolve }) => {
	// WebDAV requests bypass SvelteKit routing
	if (isDavRequest(event.url)) {
		return handleDav(event.request);
	}

	const sessionId = event.cookies.get('session');

	if (sessionId) {
		event.locals.user = validateSession(sessionId);
	} else {
		event.locals.user = null;
	}

	// ── API Rate Limiting ──
	if (event.url.pathname.startsWith('/api/')) {
		const rateLimitKey = event.locals.user?.id || event.getClientAddress();

		// Stricter limit for uploads
		if (event.url.pathname === '/api/files/upload') {
			const uploadLimit = uploadLimiter.check(`upload:${rateLimitKey}`);
			if (!uploadLimit.allowed) {
				return new Response(JSON.stringify({ error: 'Upload rate limit exceeded' }), {
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'Retry-After': String(Math.ceil(uploadLimit.retryAfterMs / 1000)),
						'X-RateLimit-Remaining': '0'
					}
				});
			}
		}

		// General API limit
		const apiLimit = apiLimiter.check(`api:${rateLimitKey}`);
		if (!apiLimit.allowed) {
			return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(Math.ceil(apiLimit.retryAfterMs / 1000)),
					'X-RateLimit-Remaining': '0'
				}
			});
		}

		const response = await resolve(event);

		// CORS — scoped to same origin or configured origins
		const origin = event.request.headers.get('origin') || '';
		const allowed = process.env.CORS_ORIGIN || event.url.origin;
		if (origin === allowed || origin === '') {
			response.headers.set('Access-Control-Allow-Origin', origin || allowed);
			response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
			response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
			response.headers.set('Vary', 'Origin');
		}

		response.headers.set('X-RateLimit-Remaining', String(apiLimit.remaining));
		addSecurityHeaders(response);
		return response;
	}

	const response = await resolve(event);
	addSecurityHeaders(response);
	return response;
};

function addSecurityHeaders(response: Response): void {
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (!response.headers.has('Content-Security-Policy')) {
		response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
	}
}
