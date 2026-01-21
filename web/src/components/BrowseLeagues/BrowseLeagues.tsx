import type { League } from '@/contracts/League';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { joinLeague } from '@/services/leagueService';
import * as Sentry from '@sentry/react';
import { useLoaderData, useNavigate } from '@tanstack/react-router';
import { Globe, Lock, Users } from 'lucide-react';
import { useCallback, useState } from 'react';

import { AppContainer } from '../AppContainer/AppContainer';
import { InlineError } from '../InlineError/InlineError';
import { LiveRegion } from '../LiveRegion/LiveRegion';
import { LoadingButton } from '../LoadingButton/LoadingButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface PublicLeaguesLoaderData {
  leagues: League[];
}

export function BrowseLeagues() {
  const { leagues } = useLoaderData({
    from: '/_authenticated/_team-required/browse-leagues',
  }) as PublicLeaguesLoaderData;

  const navigate = useNavigate();
  const [joiningLeagueId, setJoiningLeagueId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<number | null>(null);
  const { message, announce } = useLiveRegion();

  const hasAvailableLeagues = leagues.length > 0;

  const handleJoinLeague = useCallback(
    async (league: League) => {
      setJoiningLeagueId(league.id);
      setErrorMessage(null);

      try {
        await joinLeague(league.id);

        Sentry.logger.info('User joined league from browse page', {
          leagueId: league.id,
          leagueName: league.name,
        });

        // navigate to league detail page after joining
        navigate({
          to: '/league/$leagueId',
          params: { leagueId: String(league.id) },
        });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to join league. Please try again.';
        setErrorMessage(errorMsg);
        announce(errorMsg);

        Sentry.logger.error('Failed to join league from browse page', {
          leagueId: league.id,
          leagueName: league.name,
          error,
        });
      } finally {
        setJoiningLeagueId(null);
        setDialogOpen(null);
      }
    },
    [navigate, announce],
  );

  const handleDialogChange = useCallback((leagueId: number, open: boolean) => {
    setDialogOpen(open ? leagueId : null);

    if (!open) {
      // Clear errors when dialog closes
      setErrorMessage(null);
    }
  }, []);

  return (
    <AppContainer maxWidth="md">
      <LiveRegion message={message} />

      {!hasAvailableLeagues ? (
        <div className="bg-card rounded-lg p-8 text-center">
          <p className="text-muted-foreground text-lg">There are no available leagues to display</p>
        </div>
      ) : (
        <div aria-label="available-leagues" className="space-y-4">
          {leagues.map((league) => {
            const isJoining = joiningLeagueId === league.id;
            const memberCount = league.teamCount;
            const maxTeamsCount = league.maxTeams;

            return (
              <Card key={league.id} className="overflow-hidden p-0">
                <div className="p-6">
                  {/* League Header */}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{league.name}</h3>
                    <Badge className="gap-1" variant="secondary">
                      {league.isPrivate ? (
                        <>
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          <span>Private</span>
                        </>
                      ) : (
                        <>
                          <Globe className="h-3 w-3" aria-hidden="true" />
                          <span>Public</span>
                        </>
                      )}
                    </Badge>
                  </div>

                  {/* League Description */}
                  {league.description && (
                    <p className="text-muted-foreground mb-4 text-sm">{league.description}</p>
                  )}

                  {/* League Info and Action Bar */}
                  <div className="flex items-center justify-between gap-4">
                    {/* Member Count */}
                    <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                      <Users className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {memberCount} / {maxTeamsCount} members
                      </span>
                    </div>

                    {/* Join Button with Confirmation Dialog */}
                    <div className="flex flex-col items-center gap-1">
                      <AlertDialog
                        open={dialogOpen === league.id}
                        onOpenChange={(open) => handleDialogChange(league.id, open)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button size="sm" disabled={league.isPrivate}>
                            Join League
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Join {league.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              You're about to join this league. You can manage your league
                              memberships from your leagues page at any time.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction asChild>
                              <LoadingButton
                                isLoading={isJoining}
                                loadingText="Joining..."
                                onClick={() => handleJoinLeague(league)}
                              >
                                Confirm Join
                              </LoadingButton>
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {league.isPrivate && (
                        <p className="text-muted-foreground text-xs">Coming soon</p>
                      )}
                    </div>
                  </div>

                  {/* Error Message */}
                  {errorMessage && (
                    <div className="mt-4">
                      <InlineError message={errorMessage} />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppContainer>
  );
}
