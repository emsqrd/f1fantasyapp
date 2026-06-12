/**
 * Coerce an untrusted redirect value to a safe same-origin path, or `undefined`.
 *
 * Resolving against the current origin and comparing origins rejects the whole
 * open-redirect class — protocol-relative (`//evil.com`), backslash (`/\evil.com`,
 * which the URL parser folds to `//`), absolute external, and `javascript:` —
 * which a `startsWith('/')` check lets through.
 */
export function safeInternalPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return undefined;
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
}
