import type { League as LeagueType } from '@/contracts/League';
import { useLoaderData } from '@tanstack/react-router';
import { Copy, Share } from 'lucide-react';

import { AppContainer } from '../AppContainer/AppContainer';
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

// Type for the route's loader data
interface LeagueLoaderData {
  league: LeagueType;
}

export function League() {
  // Get league data from the route loader
  // Data is already loaded before this component renders (no loading state needed)
  const { league } = useLoaderData({
    from: '/_authenticated/_team-required/league/$leagueId',
  }) as LeagueLoaderData;

  return (
    <AppContainer maxWidth="md">
      <div className="">
        <div className="">
          <header className="flex justify-between pb-3">
            <h2 className="text-3xl font-bold">{league.name}</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Share />
                  League Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share League Invite</DialogTitle>
                  <DialogDescription>
                    Anyone who has this link will be able to join your league
                  </DialogDescription>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-1 gap-2">
                      <Label htmlFor="link" className="sr-only">
                        League Invite Link
                      </Label>
                      <Input id="link" defaultValue="http://www.google.com" readOnly></Input>
                      <Button>
                        <Copy />
                        Copy
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </header>
        </div>
        <Leaderboard />
      </div>
    </AppContainer>
  );
}
