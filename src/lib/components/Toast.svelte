<script lang="ts">
	import { browser } from '$app/environment';
	type ToastItem = { id: number; message: string; type: 'success' | 'error' | 'info' };
	let toasts: ToastItem[] = $state([]);
	let nextId = 0;

	export function show(message: string, type: ToastItem['type'] = 'info') {
		const id = nextId++;
		toasts = [...toasts, { id, message, type }];
		setTimeout(() => { toasts = toasts.filter(t => t.id !== id); }, 4000);
	}
	if (browser) (window as any).__lc_toast = show;
</script>

{#if toasts.length > 0}
	<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
		{#each toasts as toast (toast.id)}
			<div class="m3-snackbar {toast.type === 'error' ? '!bg-error !text-on-error' : ''}">
				<span class="material-symbols-outlined text-lg">
					{toast.type === 'error' ? 'error' : toast.type === 'success' ? 'check_circle' : 'info'}
				</span>
				{toast.message}
			</div>
		{/each}
	</div>
{/if}
