import { useAuth } from '@/hooks/useAuth';
import { profileQueries } from '@/services/userProfileService';
import { useQuery } from '@tanstack/react-query';
import { ChartNoAxesGantt, Home, type LucideIcon, Search, Users } from 'lucide-react';

export interface NavDestination {
  key: string;
  title: string;
  short: string;
  icon: LucideIcon;
  to: '/' | '/my-team' | '/leagues' | '/browse-leagues';
}

export function useNavDestinations(): NavDestination[] {
  const { user } = useAuth();
  const { data: profile } = useQuery({ ...profileQueries.current(), enabled: !!user });
  const hasTeam = profile?.hasTeam ?? false;

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
