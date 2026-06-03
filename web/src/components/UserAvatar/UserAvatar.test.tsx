import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserAvatar } from './UserAvatar';

// UserAvatar is a thin wrapper over the vendored shadcn/Radix Avatar; the only
// behavior it owns is the loading overlay. Image vs. fallback rendering is the
// primitive's job — and Radix's image load-state machine never advances in
// jsdom — so that path is left to the library (verified for real in a browser).
describe('UserAvatar', () => {
  it('overlays a loading indicator only while loading', () => {
    const { rerender } = render(<UserAvatar avatarUrl="https://example.com/a.jpg" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<UserAvatar avatarUrl="https://example.com/a.jpg" isLoading />);
    expect(screen.getByRole('status', { name: 'Loading avatar' })).toBeInTheDocument();
  });
});
