<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	let { from, to, active = false, size = 24, color = 'currentColor', duration = 300 }:
		{ from: string; to: string; active: boolean; size?: number; color?: string; duration?: number } = $props();

	let currentPath = $state(from);
	let interpolator: ((t: number) => string) | null = null;
	let reverseInterpolator: ((t: number) => string) | null = null;
	let flubberLoaded = $state(false);
	let animFrame = 0;

	onMount(async () => {
		const flubber = await import('flubber');
		interpolator = flubber.interpolate(from, to, { maxSegmentLength: 2 });
		reverseInterpolator = flubber.interpolate(to, from, { maxSegmentLength: 2 });
		flubberLoaded = true;
		currentPath = active ? to : from;
	});

	$effect(() => {
		if (!browser || !flubberLoaded || !interpolator || !reverseInterpolator) return;

		const interp = active ? interpolator : reverseInterpolator;
		const startTime = performance.now();

		cancelAnimationFrame(animFrame);

		function step(now: number) {
			const elapsed = now - startTime;
			const t = Math.min(elapsed / duration, 1);
			// M3 emphasized easing
			const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
			currentPath = interp!(eased);
			if (t < 1) animFrame = requestAnimationFrame(step);
		}

		animFrame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(animFrame);
	});
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill={color} style="display: inline-block; vertical-align: middle;">
	<path d={currentPath} />
</svg>
