/**
 * Given a boolean isHovering, returns the pointer class string
 */
export function getCursorClass(isHovering: boolean): 'pointer' | 'default' {
  return isHovering ? 'pointer' : 'default';
}

/**
 * Given a boolean isVisible, returns the corresponding class string
 */
export function getVisibilityClass(isVisible: boolean): 'visible' | 'none' {
  return isVisible ? 'visible' : 'none';
}

/**
 * Round the given value to the 10 000th
 */
export function gpsRound(val: number) {
  return Math.round(val * 10000) / 10000;
}

type AbortableRequest<T> = {
  abort: () => void;
  unwrap: () => Promise<T>;
};

/**
 * Unwraps an abortable request and connects it to an optional `AbortSignal`.
 *
 * @param startRequest - Creates the request to unwrap.
 * @param signal - Optional signal used to abort the request.
 * @returns The unwrapped request result.
 * @throws The signal's reason if already aborted, or the error from `unwrap()`.
 */
export async function unwrapRequestWithSignal<T>(
  startRequest: () => AbortableRequest<T>,
  opts: { signal?: AbortSignal } = {}
): Promise<T> {
  if (opts.signal?.aborted) throw opts.signal.reason ?? new Error('Aborted');
  const request = startRequest();
  const abortRequest = () => request.abort();
  opts.signal?.addEventListener('abort', abortRequest, { once: true });
  try {
    return await request.unwrap();
  } finally {
    opts.signal?.removeEventListener('abort', abortRequest);
  }
}
