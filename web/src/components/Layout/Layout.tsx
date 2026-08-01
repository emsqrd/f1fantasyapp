import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { Outlet, useMatches, useNavigate } from '@tanstack/react-router';
import { Trophy } from 'lucide-react';

import { AppSidebar } from '../AppSidebar/AppSidebar';
import { MobileBottomNav } from '../MobileBottomNav/MobileBottomNav';
import { MobileTopBar } from '../MobileTopBar/MobileTopBar';
import { Button } from '../ui/button';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../ui/sidebar';

export function Layout() {
  const { user } = useAuth();
  const matches = useMatches();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Get page title from the deepest route match that has staticData.pageTitle
  const matchWithTitle = [...matches]
    .reverse()
    .find((match) => (match.staticData as { pageTitle?: string })?.pageTitle);
  const pageTitle = (matchWithTitle?.staticData as { pageTitle?: string })?.pageTitle;

  // A route can ask for the signed-out shell even when a session exists: the
  // password reset page signs the user in as it submits, and growing a sidebar
  // around the card mid-submit is disorienting.
  const forcesPublicShell = matches.some(
    (match) => (match.staticData as { publicShell?: boolean })?.publicShell,
  );

  if (!user || forcesPublicShell) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <div
            className="flex cursor-pointer items-center gap-2"
            onClick={() => navigate({ to: '/' })}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void navigate({ to: '/' });
              }
            }}
            aria-label="Navigate to home page"
          >
            <Trophy className="h-6 w-6" />
            <span className="text-lg font-bold">F1 Fantasy Sports</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: '/sign-in' })}>
              Sign In
            </Button>
            <Button onClick={() => navigate({ to: '/sign-up' })}>Sign Up</Button>
          </div>
        </header>
        <Outlet />
      </>
    );
  }

  // Render mobile shell for authenticated users on small viewports
  if (isMobile) {
    return (
      <div className="flex min-h-svh flex-col">
        <MobileTopBar />
        {/* Bottom padding clears the fixed MobileBottomNav (its height + safe-area inset) */}
        <main className="flex-1 p-4 pb-(--bottom-nav-space)">
          <Outlet />
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  // Render sidebar layout for authenticated routes
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          {pageTitle && (
            <>
              <div className="bg-border h-4 w-px" />
              <h1 className="text-lg font-semibold">{pageTitle}</h1>
            </>
          )}
        </header>
        <div className="flex flex-1 flex-col p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
