<script lang="ts">
	import type { Snippet } from 'svelte';
	import { browser } from '$app/environment';

	let { text, children, position = 'bottom' }: {
		text: string;
		children: Snippet;
		position?: 'top' | 'bottom' | 'left' | 'right';
	} = $props();

	let visible = $state(false);
	let timer: ReturnType<typeof setTimeout>;
	let triggerEl: HTMLDivElement;
	let portalEl: HTMLDivElement | undefined;

	function show() {
		if (!text || !triggerEl || !browser) return;

		const rect = triggerEl.getBoundingClientRect();
		const gap = 6;

		// Create portal element on body
		portalEl = document.createElement('div');
		portalEl.setAttribute('role', 'tooltip');
		portalEl.style.cssText = `
			position: fixed;
			z-index: 9999;
			pointer-events: none;
			white-space: nowrap;
			padding: 6px 12px;
			border-radius: 8px;
			font-size: 12px;
			line-height: 16px;
			font-weight: 500;
			max-width: 240px;
			background: var(--color-inverse-surface, #313131);
			color: var(--color-inverse-on-surface, #f4f4f4);
			box-shadow: 0 2px 6px rgba(0,0,0,0.2);
			opacity: 0;
			transition: opacity 150ms;
		`;
		portalEl.textContent = text;
		document.body.appendChild(portalEl);

		// Measure tooltip size after render
		requestAnimationFrame(() => {
			if (!portalEl) return;
			const tipRect = portalEl.getBoundingClientRect();
			let x = 0, y = 0;

			if (position === 'right') {
				x = rect.right + gap;
				y = rect.top + rect.height / 2 - tipRect.height / 2;
				// If overflows right edge, flip to left
				if (x + tipRect.width > window.innerWidth - 8) {
					x = rect.left - gap - tipRect.width;
				}
			} else if (position === 'left') {
				x = rect.left - gap - tipRect.width;
				y = rect.top + rect.height / 2 - tipRect.height / 2;
				if (x < 8) {
					x = rect.right + gap;
				}
			} else if (position === 'bottom') {
				x = rect.left + rect.width / 2 - tipRect.width / 2;
				y = rect.bottom + gap;
				// If overflows bottom, show above
				if (y + tipRect.height > window.innerHeight - 8) {
					y = rect.top - gap - tipRect.height;
				}
			} else if (position === 'top') {
				x = rect.left + rect.width / 2 - tipRect.width / 2;
				y = rect.top - gap - tipRect.height;
				if (y < 8) {
					y = rect.bottom + gap;
				}
			}

			// Clamp to viewport
			x = Math.max(8, Math.min(x, window.innerWidth - tipRect.width - 8));
			y = Math.max(8, Math.min(y, window.innerHeight - tipRect.height - 8));

			portalEl.style.left = `${x}px`;
			portalEl.style.top = `${y}px`;
			portalEl.style.opacity = '1';
		});
	}

	function hide() {
		if (portalEl) {
			portalEl.remove();
			portalEl = undefined;
		}
	}

	function enter() {
		if (!text) return;
		timer = setTimeout(() => { visible = true; show(); }, 400);
	}
	function leave() {
		clearTimeout(timer);
		visible = false;
		hide();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={triggerEl} class="relative inline-flex" onmouseenter={enter} onmouseleave={leave} onfocus={enter} onblur={leave}>
	{@render children()}
</div>
