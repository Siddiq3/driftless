/** Native SDK promises may never settle. Release the caller even when cancellation is unavailable. */
export async function withDeadline<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutError: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timeoutError()), timeoutMs);
      }),
      operation(),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
