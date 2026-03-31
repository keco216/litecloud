interface RateLimiterConfig {
	windowMs: number;
	max: number;
	cleanupIntervalMs?: number;
}

interface RateLimitEntry {
	count: number;
	firstAttempt: number;
	blockedUntil: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfterMs: number;
	totalAttempts: number;
}

export function createRateLimiter(config: RateLimiterConfig) {
	const store = new Map<string, RateLimitEntry>();
	const { windowMs, max, cleanupIntervalMs = 60_000 } = config;

	const cleanupTimer = setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (now - entry.firstAttempt > windowMs && entry.blockedUntil < now) {
				store.delete(key);
			}
		}
	}, cleanupIntervalMs);

	if (cleanupTimer.unref) cleanupTimer.unref();

	return {
		check(key: string): RateLimitResult {
			const now = Date.now();
			const entry = store.get(key);

			if (!entry) {
				store.set(key, { count: 1, firstAttempt: now, blockedUntil: 0 });
				return { allowed: true, remaining: max - 1, retryAfterMs: 0, totalAttempts: 1 };
			}

			if (entry.blockedUntil > now) {
				return { allowed: false, remaining: 0, retryAfterMs: entry.blockedUntil - now, totalAttempts: entry.count };
			}

			if (now - entry.firstAttempt > windowMs) {
				store.set(key, { count: 1, firstAttempt: now, blockedUntil: 0 });
				return { allowed: true, remaining: max - 1, retryAfterMs: 0, totalAttempts: 1 };
			}

			entry.count++;

			if (entry.count > max) {
				const overMax = entry.count - max;
				const lockouts = [60_000, 300_000, 900_000, 1_800_000, 3_600_000];
				const lockoutMs = lockouts[Math.min(overMax - 1, 4)];
				entry.blockedUntil = now + lockoutMs;
				return { allowed: false, remaining: 0, retryAfterMs: lockoutMs, totalAttempts: entry.count };
			}

			return { allowed: true, remaining: max - entry.count, retryAfterMs: 0, totalAttempts: entry.count };
		},

		reset(key: string): void {
			store.delete(key);
		},

		isBlocked(key: string): boolean {
			const entry = store.get(key);
			return !!entry && entry.blockedUntil > Date.now();
		},

		getStats(): { totalKeys: number } {
			return { totalKeys: store.size };
		}
	};
}

// ── Pre-configured limiters ──

export const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
export const apiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 200 });
export const shareLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
export const uploadLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 50 });
export const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3 });
