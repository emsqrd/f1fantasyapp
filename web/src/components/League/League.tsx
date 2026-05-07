import type { LeagueInvite } from '@/contracts/LeagueInvite';
import { useClipboard } from '@/hooks/useClipboard';
import { getOrCreateLeagueInvite } from '@/services/leagueInviteService';
import * as Sentry from '@sentry/react';
import { getRouteApi, useRouteContext } from '@tanstack/react-router';
import { Check, Copy, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { AppContainer } from '../AppContainer/AppContainer';
import { InlineError } from '../InlineError/InlineError';
import { Leaderboard } from '../Leaderboard/Leaderboard';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const routeApi = getRouteApi('/_authenticated/_team-required/league/$leagueId');

export function League() {
  const { profile } = useRouteContext({
    from: '/_authenticated/_team-required/league/$leagueId',
  });
  const { league } = routeApi.useLoaderData();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [leagueInvite, setLeagueInvite] = useState<LeagueInvite | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { copy, reset, hasCopied } = useClipboard();

  const inviteUrl = leagueInvite ? `${window.location.origin}/join/${leagueInvite.token}` : '';
  const isOwner = profile?.id === league.ownerId;
  const displayInviteButton = isOwner && league.isPrivate;

  const handleDialogOpen = async (open: boolean) => {
    setIsDialogOpen(open);

    if (!open) {
      reset();
    }

    if (open && !leagueInvite && !isLoading) {
      setIsLoading(true);
      setError(null);
      try {
        const leagueInvite = await getOrCreateLeagueInvite(league.id);
        setLeagueInvite(leagueInvite);
      } catch (error) {
        setError('Failed to load invite link');
        Sentry.logger.error('Failed to load invite', { leagueId: league.id, error });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <AppContainer maxWidth="md">
      {displayInviteButton && (
        <div className="flex justify-end pb-2">
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0">
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share League Invite</DialogTitle>
                <DialogDescription>
                  Anyone who has this link will be able to join your league
                </DialogDescription>
              </DialogHeader>
              {isLoading && <div>Loading invite link...</div>}
              {error && <InlineError message={error} />}
              {leagueInvite && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="link" className="sr-only">
                    League Invite Link
                  </Label>
                  <Input id="link" className="flex-1" value={inviteUrl} readOnly></Input>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copy(inviteUrl)}
                    aria-label={hasCopied ? 'Copied' : 'Copy invite link'}
                  >
                    {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
      <Leaderboard />
    </AppContainer>
  );
}
