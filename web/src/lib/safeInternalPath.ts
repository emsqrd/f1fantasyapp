/**
 * Coerce an untrusted redirect value to a safe same-origin path, or `undefined`.
 *
 * Resolving against the current origin and comparing origins rejects the whole
 * open-redirect class — protocol-relative (`//evil.com`), backslash (`/\evil.com`,
 * which the URL parser folds to `//`), absolute external, and `javascript:` —
 * which a `startsWith('/')` check lets through. Origin-matching alone is not
 * enough: dot-segment folding (`/..//evil.com`) resolves same-origin yet yields a
 * `//evil.com` pathname that is protocol-relative if reused as an href, so a
 * `//`-leading result is rejected too.
 */
export function safeInternalPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return undefined;
    const path = url.pathname + url.search + url.hash;
    return path.startsWith('//') ? undefined : path;
  } catch {
    return undefined;
  }
}
