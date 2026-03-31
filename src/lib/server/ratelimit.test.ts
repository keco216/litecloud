import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRateLimiter } from './ratelimit';

describe('createRateLimiter', () => {
	let limiter: ReturnType<typeof createRateLimiter>;

	beforeEach(() => {
		vi.useFakeTimers();
		limiter = createRateLimiter({ windowMs: 10_000, max: 3 });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('allows the first request with remaining = max - 1', () => {
		const result = limiter.check('ip1');
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(2);
		expect(result.retryAfterMs).toBe(0);
		expect(result.totalAttempts).toBe(1);
	});

	it('allows requests up to max', () => {
		for (let i = 1; i <= 3; i++) {
			const result = limiter.check('ip2');
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(3 - i);
			expect(result.totalAttempts).toBe(i);
		}
	});

	it('blocks request at max + 1 with retryAfterMs > 0', () => {
		for (let i = 0; i < 3; i++) {
			limiter.check('ip3');
		}

		const blocked = limiter.check('ip3');
		expect(blocked.allowed).toBe(false);
		expect(blocked.remaining).toBe(0);
		expect(blocked.retryAfterMs).toBeGreaterThan(0);
		expect(blocked.totalAttempts).toBe(4);
	});

	it('escalates lockout duration on repeated violations', () => {
		// Use a limiter with a window larger than the first lockout (60s)
		// so the entry is not reset when we advance past the lockout.
		const wideWindowLimiter = createRateLimiter({ windowMs: 120_000, max: 3 });

		// Exhaust the limit
		for (let i = 0; i < 3; i++) {
			wideWindowLimiter.check('ip4');
		}

		// 1st block (count=4, overMax=1) -> lockouts[0] = 60_000
		const first = wideWindowLimiter.check('ip4');
		expect(first.allowed).toBe(false);
		const firstLockout = first.retryAfterMs;
		expect(firstLockout).toBe(60_000);

		// Advance past the first lockout so we are unblocked
		vi.advanceTimersByTime(firstLockout + 1);

		// 2nd block (count=5, overMax=2) -> lockouts[1] = 300_000
		const second = wideWindowLimiter.check('ip4');
		expect(second.allowed).toBe(false);
		const secondLockout = second.retryAfterMs;
		expect(secondLockout).toBe(300_000);

		expect(secondLockout).toBeGreaterThan(firstLockout);
	});

	it('resets counter after the window expires', () => {
		for (let i = 0; i < 3; i++) {
			limiter.check('ip5');
		}

		// Advance past the 10s window
		vi.advanceTimersByTime(10_001);

		const result = limiter.check('ip5');
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(2);
		expect(result.totalAttempts).toBe(1);
	});

	it('reset(key) clears the entry so the next request is allowed', () => {
		for (let i = 0; i < 3; i++) {
			limiter.check('ip6');
		}
		// 4th request -> blocked
		const blocked = limiter.check('ip6');
		expect(blocked.allowed).toBe(false);

		limiter.reset('ip6');

		const afterReset = limiter.check('ip6');
		expect(afterReset.allowed).toBe(true);
		expect(afterReset.remaining).toBe(2);
		expect(afterReset.totalAttempts).toBe(1);
	});

	it('isBlocked returns true when blocked, false otherwise', () => {
		expect(limiter.isBlocked('ip7')).toBe(false);

		// Use up the limit
		for (let i = 0; i < 3; i++) {
			limiter.check('ip7');
		}
		expect(limiter.isBlocked('ip7')).toBe(false);

		// Trigger a block
		limiter.check('ip7');
		expect(limiter.isBlocked('ip7')).toBe(true);
	});

	it('different keys do not interfere with each other', () => {
		// Exhaust keyA
		for (let i = 0; i < 3; i++) {
			limiter.check('keyA');
		}
		const blockedA = limiter.check('keyA');
		expect(blockedA.allowed).toBe(false);

		// keyB should still be fresh
		const resultB = limiter.check('keyB');
		expect(resultB.allowed).toBe(true);
		expect(resultB.remaining).toBe(2);
	});

	it('getStats returns the correct totalKeys count', () => {
		expect(limiter.getStats().totalKeys).toBe(0);

		limiter.check('a');
		expect(limiter.getStats().totalKeys).toBe(1);

		limiter.check('b');
		expect(limiter.getStats().totalKeys).toBe(2);

		limiter.check('a'); // same key, no new entry
		expect(limiter.getStats().totalKeys).toBe(2);

		limiter.reset('a');
		expect(limiter.getStats().totalKeys).toBe(1);
	});
});
