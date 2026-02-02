import type { League } from '@/contracts/League';
import { Link, useLoaderData, useRouteContext } from '@tanstack/react-router';

import { Badge } from '../ui/badge';
import { buttonVariants } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface LeagueLoaderData {
  league: League;
}

export function Leaderboard() {
  // Get league data from the route loader
  const { league } = useLoaderData({
    from: '/_authenticated/_team-required/league/$leagueId',
  }) as LeagueLoaderData;

  const hasTeams = league.teams.length > 0;

  const { profile } = useRouteContext({ from: '/_authenticated' });

  return (
    <>
      {!hasTeams ? (
        <div className="bg-card rounded-lg p-8 text-center">
          <p className="text-muted-foreground text-lg">No teams in this league yet.</p>
        </div>
      ) : (
        <Table className="bg-card overflow-hidden rounded-lg">
          <TableHeader className="bg-secondary sticky top-0 font-bold">
            <TableRow>
              <TableHead className="text-center font-bold">Rank</TableHead>
              <TableHead className="min-w-48 font-bold">Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {league.teams.map((team, index) => {
              const isMyTeam = team.ownerId === profile?.id;

              return (
                <TableRow key={team.id} className="hover:bg-accent transition-colors">
                  <TableCell className="text-center align-top">{index + 1}</TableCell>
                  <TableCell className="flex min-w-48 items-center justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        {team.name}
                        {isMyTeam && <Badge className="ml-2">You</Badge>}
                      </div>
                      <div className="text-muted-foreground text-xs">{team.ownerName}</div>
                    </div>
                    <Link
                      to={isMyTeam ? '/my-team' : '/team/$teamId'}
                      params={isMyTeam ? undefined : { teamId: String(team.id) }}
                      className={buttonVariants({ variant: 'outline' })}
                      aria-label={`View team: ${team.name}`}
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}
