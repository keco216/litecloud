import { browser } from '$app/environment';

const KEY = 'litecloud-sidebar-collapsed';

function getInitial(): boolean {
	if (!browser) return false;
	try { return localStorage.getItem(KEY) === 'true'; } catch { return false; }
}

let collapsed = $state(getInitial());

export function useSidebar() {
	return {
		get collapsed() { return collapsed; },
		toggle() {
			collapsed = !collapsed;
			if (browser) try { localStorage.setItem(KEY, String(collapsed)); } catch {}
		},
		collapse() {
			collapsed = true;
			if (browser) try { localStorage.setItem(KEY, 'true'); } catch {}
		},
		expand() {
			collapsed = false;
			if (browser) try { localStorage.setItem(KEY, 'false'); } catch {}
		}
	};
}
