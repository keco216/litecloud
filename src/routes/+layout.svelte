<script>
	import '../app.css';
	import { browser } from '$app/environment';
	import { getLocale } from '$lib/i18n/index.svelte';
	import Toast from '$lib/components/Toast.svelte';
	let { children } = $props();

	// Apply saved theme preference on first load
	if (browser) {
		const saved = localStorage.getItem('lc-theme');
		if (saved === 'dark') document.documentElement.classList.add('dark-override');
		else if (saved === 'light') document.documentElement.classList.add('light-override');
		document.documentElement.lang = getLocale();
	}
</script>

{@render children()}
<Toast />
