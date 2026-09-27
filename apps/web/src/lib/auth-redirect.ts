const FALLBACK_PATH = '/dashboard';
const VALIDATION_ORIGIN = 'https://big-eye.invalid';

/**
 * Accept only an in-app path from the middleware's `next` query parameter.
 * The fixed origin makes protocol-relative and absolute URLs fail closed.
 */
export function getSafeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return FALLBACK_PATH;
  }

  try {
    const target = new URL(value, VALIDATION_ORIGIN);
    if (target.origin !== VALIDATION_ORIGIN) {
      return FALLBACK_PATH;
    }

    return `${target.pathname}${target.search}`;
  } catch {
    return FALLBACK_PATH;
  }
}
