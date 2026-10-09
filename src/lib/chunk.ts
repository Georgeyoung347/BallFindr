/**
 * Splits a list into consecutive chunks of at most `size` items. Used to keep
 * PostgREST `.in("id", ids)` filters short enough for URL length limits.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1)
    throw new RangeError("chunk size must be a positive integer");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Max ids per `.in()` filter. A uuid costs ~39 URL characters once encoded, so
 * 150 ids keep the request line near 6 KB, under common 8 KB proxy limits.
 */
export const IN_FILTER_CHUNK = 150;
