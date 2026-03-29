import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth';
import { isDavRequest, handleDav } from '$lib/server/webdav';

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

	const response = await resolve(event);

	// CORS — only for API routes, scoped to same origin or configured origins
	if (event.url.pathname.startsWith('/api/')) {
		const origin = event.request.headers.get('origin') || '';
		const allowed = process.env.CORS_ORIGIN || event.url.origin;
		if (origin === allowed || origin === '') {
			response.headers.set('Access-Control-Allow-Origin', origin || allowed);
			response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
			response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
			response.headers.set('Vary', 'Origin');
		}
	}

	return response;
};
