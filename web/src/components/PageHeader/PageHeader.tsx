import { useAuth } from '@/hooks/useAuth';
import { useTeam } from '@/hooks/useTeam';
import { avatarEvents } from '@/lib/avatarEvents';
import { useLocation, useMatches, useNavigate } from '@tanstack/react-router';
import { CircleUser, Loader2, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export function PageHeader() {
  const { user, signOut, loading } = useAuth();
  const { hasTeam, myTeamId } = useTeam();

  // Get profile from route context (fetched at root route level)
  const matches = useMatches();
  const rootMatch = matches.find((m) => m.routeId === '__root__');
  const profile = rootMatch?.context?.profile;

  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | undefined>();
  const [isImageLoading, setIsImageLoading] = useState(false);

  const avatarUrl = profile?.avatarUrl || undefined;
  const displayAvatarUrl = uploadedAvatarUrl ?? avatarUrl;

  const location = useLocation();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate({ to: '/' });
  };

  const handleAccountClick = () => {
    navigate({ to: '/account' });
  };

  const handleLeagues = () => {
    navigate({ to: '/leagues' });
  };

  const handleMyTeam = () => {
    navigate({ to: '/team/$teamId', params: { teamId: String(myTeamId) } });
  };

  const handleCreateTeam = () => {
    navigate({ to: '/create-team' });
  };

  const handleSignOut = () => {
    signOut();
    navigate({ to: '/' });
  };

  const handleSignIn = () => {
    navigate({ to: '/sign-in' });
  };

  useEffect(() => {
    if (displayAvatarUrl) {
      setIsImageLoading(true);
    }
  }, [displayAvatarUrl]);

  // Listen for avatar update events
  useEffect(() => {
    const unsubscribe = avatarEvents.subscribe((newAvatarUrl) => {
      setUploadedAvatarUrl(newAvatarUrl);
    });

    return unsubscribe;
  }, []);

  // Hide auth buttons on auth pages
  const isAuthPage = location.pathname === '/sign-in' || location.pathname === '/sign-up';

  return (
    <nav className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b backdrop-blur">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div
            className="flex cursor-pointer items-center space-x-2"
            onClick={handleLogoClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleLogoClick();
              }
            }}
            aria-label="Navigate to home page"
          >
            <Trophy className="text-primary h-8 w-8" />
            <span className="from-primary to-primary/70 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
              F1 Fantasy Sports
            </span>
          </div>
          <div className="flex space-x-4">
            <div className="items-center">
              {!isAuthPage && !loading && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="data-[state=open]:bg-accent focus-visible:ring-0 focus-visible:ring-offset-0"
                      size="icon"
                    >
                      <Avatar>
                        <AvatarImage
                          src={displayAvatarUrl}
                          alt="User avatar"
                          onLoad={() => setIsImageLoading(false)}
                          onError={() => setIsImageLoading(false)}
                        />
                        <AvatarFallback>
                          <CircleUser className="size-8" />
                        </AvatarFallback>
                        {/* Loading Overlay */}
                        {isImageLoading && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          </div>
                        )}
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="[&>*]:cursor-pointer" align="end">
                    {user ? (
                      <>
                        <DropdownMenuItem onClick={handleAccountClick}>My Account</DropdownMenuItem>
                        {hasTeam ? (
                          <>
                            <DropdownMenuItem onClick={handleLeagues}>My Leagues</DropdownMenuItem>
                            <DropdownMenuItem onClick={handleMyTeam}>My Team</DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={handleCreateTeam}>
                            Create Team
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onClick={handleSignIn}>Sign In</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
