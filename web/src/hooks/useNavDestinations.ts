import { useRouteContext } from '@tanstack/react-router';
import { ChartNoAxesGantt, Home, type LucideIcon, Search, Users } from 'lucide-react';

export interface NavDestination {
  key: string;
  title: string;
  short: string;
  icon: LucideIcon;
  to: '/' | '/my-team' | '/leagues' | '/browse-leagues';
}

export function useNavDestinations(): NavDestination[] {
  const { team } = useRouteContext({ from: '__root__' });
  const hasTeam = team !== null;

  const destinations: NavDestination[] = [
    { key: 'home', title: 'Home', short: 'Home', icon: Home, to: '/' },
  ];

  if (hasTeam) {
    destinations.push(
      { key: 'team', title: 'My Team', short: 'Team', icon: Users, to: '/my-team' },
      {
        key: 'leagues',
        title: 'My Leagues',
        short: 'Leagues',
        icon: ChartNoAxesGantt,
        to: '/leagues',
      },
      {
        key: 'browse',
        title: 'Browse Leagues',
        short: 'Browse',
        icon: Search,
        to: '/browse-leagues',
      },
    );
  }

  return destinations;
}
