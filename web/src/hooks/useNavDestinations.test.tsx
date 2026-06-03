import { TeamContext } from '@/contexts/TeamContext';
import { useNavDestinations } from '@/hooks/useNavDestinations';
import { createTeamContext } from '@/tests/test-utils';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

function renderNavDestinations(hasTeam: boolean) {
  return renderHook(() => useNavDestinations(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <TeamContext.Provider value={createTeamContext({ hasTeam })}>{children}</TeamContext.Provider>
    ),
  });
}

describe('useNavDestinations', () => {
  it('returns Home only when the user has no team', () => {
    const { result } = renderNavDestinations(false);

    expect(result.current.map((d) => d.to)).toEqual(['/']);
  });

  it('returns Home plus the team destinations when the user has a team', () => {
    const { result } = renderNavDestinations(true);

    expect(result.current.map((d) => ({ to: d.to, title: d.title, short: d.short }))).toEqual([
      { to: '/', title: 'Home', short: 'Home' },
      { to: '/my-team', title: 'My Team', short: 'Team' },
      { to: '/leagues', title: 'My Leagues', short: 'Leagues' },
      { to: '/browse-leagues', title: 'Browse Leagues', short: 'Browse' },
    ]);
  });
});
