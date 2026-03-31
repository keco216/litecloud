import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		alias: {
			$lib: resolve('./src/lib')
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
		globals: true,
		environmentMatchGlobs: [
			['src/lib/crypto.test.ts', 'jsdom']
		]
	}
});
