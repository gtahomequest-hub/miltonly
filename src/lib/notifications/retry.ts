// Retry-with-exponential-backoff wrapper for outbound notification calls
// (Resend + Twilio at /api/leads). Tonight (2026-05-12 ~23:08 ET) every
// outbound call from a single lead submission failed simultaneously with
// network errors — third such incident in 72 hours from intermittent
// Vercel iad1 → external-HTTPS outbound degradation. Wrapping each
// outbound call here absorbs 1-2 transient failures per attempt without
// losing the realtor notification.
//
// Behavior:
//   - Up to maxAttempts tries (default 3)
//   - Exponential backoff: baseDelayMs * 2^(attempt-1) ms between tries
//     (default 1500ms / 3000ms / 6000ms)
//   - console.warn on each non-final failure with attempt + label + leadId
//   - On final-attempt failure, re-throws the last error so the caller's
//     existing .catch() chain still logs the original send-failed line
//   - console.log "retry succeeded" ONLY when attempt > 1 (silent on
//     first-try success — no log pollution on happy path)
//
// Pure utility — no env reads, no I/O, no side effects beyond the
// caller's operation + console writes.

export interface RetryOptions {
  /** Human-readable identifier for log correlation, e.g. "resend:realtor-email". */
  label: string;
  /** Lead ID this retry chain is correlated with — written into every log line. */
  leadId: string;
  /** Max total tries including the first. Default 3. */
  maxAttempts?: number;
  /** Initial delay before the second attempt, in milliseconds. Default 1500ms. */
  baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `operation()` up to `opts.maxAttempts` times, waiting an
 * exponentially-growing delay between failures. Re-throws the last error
 * if every attempt fails. Returns the resolved value on success.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1500;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        console.log("[retry succeeded]", {
          label: opts.label,
          leadId: opts.leadId,
          attempt,
        });
      }
      return result;
    } catch (err) {
      lastError = err;
      const isFinalAttempt = attempt === maxAttempts;
      console.warn("[retry attempt " + attempt + "/" + maxAttempts + "]", {
        label: opts.label,
        leadId: opts.leadId,
        error: err instanceof Error ? err.message : String(err),
        willRetry: !isFinalAttempt,
      });
      if (isFinalAttempt) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}
