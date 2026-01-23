import type { League } from '@/contracts/League';
import { Link, useLoaderData } from '@tanstack/react-router';

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
              <TableHead className="text-center text-lg font-bold">Rank</TableHead>
              <TableHead className="min-w-48 text-lg font-bold">Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {league.teams.map((team, index) => (
              <TableRow key={team.id} className="hover:bg-accent transition-colors">
                <TableCell className="text-center align-top text-lg">{index + 1}</TableCell>
                <TableCell className="min-w-48 align-top">
                  <Link
                    to="/team/$teamId"
                    params={{ teamId: String(team.id) }}
                    className="focus:ring-ring block cursor-pointer text-left focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    aria-label={`View team: ${team.name}`}
                    preload="intent"
                  >
                    <div className="flex flex-col">
                      <div className="text-lg hover:underline">{team.name}</div>
                      <div className="text-muted-foreground">{team.ownerName}</div>
                    </div>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
