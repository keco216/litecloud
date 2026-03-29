<script lang="ts">
	import { browser } from '$app/environment';
	type ToastItem = { id: number; message: string; type: 'success' | 'error' | 'info'; action?: { label: string; callback: () => void } };
	let toasts: ToastItem[] = $state([]);
	let nextId = 0;

	export function show(message: string, type: ToastItem['type'] = 'info', action?: { label: string; callback: () => void }) {
		const id = nextId++;
		toasts = [...toasts, { id, message, type, action }];
		const duration = action ? 8000 : 4000;
		setTimeout(() => { toasts = toasts.filter(t => t.id !== id); }, duration);
	}

	function dismiss(id: number) { toasts = toasts.filter(t => t.id !== id); }

	if (browser) (window as any).__lc_toast = show;
</script>

{#if toasts.length > 0}
	<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
		{#each toasts as toast (toast.id)}
			<div class="m3-snackbar {toast.type === 'error' ? '!bg-error !text-on-error' : ''}">
				<span class="material-symbols-outlined text-lg">
					{toast.type === 'error' ? 'error' : toast.type === 'success' ? 'check_circle' : 'info'}
				</span>
				<span class="flex-1">{toast.message}</span>
				{#if toast.action}
					<button
						onclick={() => { toast.action?.callback(); dismiss(toast.id); }}
						class="ml-2 text-inverse-primary font-medium m3-label-large hover:underline cursor-pointer"
					>{toast.action.label}</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}
