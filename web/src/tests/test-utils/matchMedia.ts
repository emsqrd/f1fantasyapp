let mobileViewport = false;

/**
 * Drives `useIsMobile()` in tests by setting whether `matchMedia` reports the
 * mobile breakpoint as matching. The `change` listeners are no-ops, so flip
 * this before mount, not mid-render.
 */
export function setMobileViewport(value: boolean): void {
  mobileViewport = value;
}

// jsdom has no `matchMedia`. Report the mobile breakpoint query against the
// `mobileViewport` flag (everything else, e.g. `next-themes`'s color-scheme
// query, stays unmatched).
export function installMatchMediaMock(): void {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: query.includes('max-width') ? mobileViewport : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
