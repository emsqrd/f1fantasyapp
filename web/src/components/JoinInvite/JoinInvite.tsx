import { InlineError } from '@/components/InlineError/InlineError';
import { LiveRegion } from '@/components/LiveRegion/LiveRegion';
import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeagueInvitePreviewResponse } from '@/contracts/LeagueInvitePreviewResponse';
import { useAuth } from '@/hooks/useAuth';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { useTeam } from '@/hooks/useTeam';
import { joinViaInvite } from '@/services/leagueInviteService';
import * as Sentry from '@sentry/react';
import { Link, useLoaderData, useNavigate, useParams } from '@tanstack/react-router';
import { AlertCircle, Lock, Users } from 'lucide-react';
import { useState } from 'react';

import { AppContainer } from '../AppContainer/AppContainer';

// Type for the route's loader data
interface JoinInviteLoaderData {
  preview: LeagueInvitePreviewResponse;
}

/**
 * JoinInvite component - displays league preview and handles join flow.
 *
 * Auth flow:
 * - Unauthenticated: Shows "Sign In to Join" / "Create Account" buttons
 * - Authenticated without team: Shows "Create Team First" button
 * - Authenticated with team: Shows "Join League" button
 *
 * Uses redirect search params to preserve invite link through sign-in/team creation flows.
 */
export function JoinInvite() {
  // Get league preview data from route loader
  const { preview } = useLoaderData({
    from: '/join/$token',
  }) as JoinInviteLoaderData;

  // Get token from route params for redirect URLs
  const { token } = useParams({ from: '/join/$token' });

  // Auth and team state
  const { user } = useAuth();
  const { hasTeam } = useTeam();

  // Join operation state
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigation and announcements
  const navigate = useNavigate();
  const { message, announce } = useLiveRegion();

  const handleJoinLeague = async () => {
    setIsJoining(true);
    setError(null);

    try {
      const league = await joinViaInvite(token);

      if (!league) {
        const errorMessage = 'Failed to join league';
        setError(errorMessage);
        announce(errorMessage);
        Sentry.logger.error('Join via invite returned null', { token });
        return;
      }

      announce(`Successfully joined ${league.name}`);

      // Navigate to the league page (convert ID to string for route params)
      await navigate({
        to: '/league/$leagueId',
        params: { leagueId: String(league.id) },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMessage);
      announce(errorMessage);
      Sentry.logger.error('Failed to join league via invite', { token, error });
    } finally {
      setIsJoining(false);
    }
  };

  // Build redirect URL for sign-in/team creation flows
  const redirectUrl = `/join/${token}`;

  return (
    <AppContainer maxWidth="md">
      <div className="flex w-full items-center justify-center p-8 md:min-h-screen">
        <div className="w-full max-w-md space-y-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{preview.leagueName}</CardTitle>
              <CardDescription>
                {preview.leagueDescription || 'Join this F1 fantasy league'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LiveRegion message={message} />

              {/* League details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                  <span>
                    Owner: <span className="font-medium">{preview.ownerName}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                  <span>
                    {preview.currentTeamCount} / {preview.maxTeams} teams
                  </span>
                </div>
              </div>

              {/* League full state */}
              {preview.isLeagueFull && (
                <div
                  className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-sm"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <p>This league is full and cannot accept new members.</p>
                </div>
              )}

              {/* Join operation error */}
              {error && <InlineError message={error} />}

              {/* Action buttons based on auth/team state */}
              {!preview.isLeagueFull && (
                <div className="space-y-3">
                  {!user ? (
                    // Unauthenticated: Show sign-in and sign-up buttons
                    <>
                      <Button asChild className="w-full">
                        <Link to="/sign-in" search={{ redirect: redirectUrl }}>
                          Sign In to Join
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/sign-up" search={{ redirect: redirectUrl }}>
                          Create Account
                        </Link>
                      </Button>
                    </>
                  ) : !hasTeam ? (
                    // Authenticated but no team: Show create team button
                    <Button asChild className="w-full">
                      <Link to="/create-team" search={{ redirect: redirectUrl }}>
                        Create Team First
                      </Link>
                    </Button>
                  ) : (
                    // Authenticated with team: Show join button
                    <LoadingButton
                      className="w-full"
                      onClick={handleJoinLeague}
                      isLoading={isJoining}
                      loadingText="Joining..."
                    >
                      Join League
                    </LoadingButton>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppContainer>
  );
}
