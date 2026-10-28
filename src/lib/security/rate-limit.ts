/**
 * Rate Limiter sederhana berbasis sliding window memory.
 * Membatasi percobaan login untuk mitigasi serangan brute-force.
 */

interface RateLimitRecord {
  attempts: number[];
}

const loginAttempts = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetSeconds: number;
}

export function checkLoginRateLimit(
  key: string,
  maxAttempts = 5,
  windowSeconds = 300
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;

  const record = loginAttempts.get(key) || { attempts: [] };
  // Hapus percobaan yang sudah melewati jendela waktu
  const activeAttempts = record.attempts.filter((timestamp) => timestamp > cutoff);

  if (activeAttempts.length >= maxAttempts) {
    const oldest = activeAttempts[0];
    const resetSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetSeconds: Math.max(1, resetSeconds),
    };
  }

  return {
    success: true,
    remaining: maxAttempts - activeAttempts.length,
    resetSeconds: 0,
  };
}

export function recordLoginAttempt(key: string): void {
  const now = Date.now();
  const record = loginAttempts.get(key) || { attempts: [] };
  record.attempts.push(now);
  loginAttempts.set(key, record);
}

export function clearLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}
