import { Outlet, useMatches, useNavigate } from '@tanstack/react-router';
import { Trophy } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';

import { AppSidebar } from '../AppSidebar/AppSidebar';
import { Button } from '../ui/button';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../ui/sidebar';

export function Layout() {
  const { user } = useAuth();
  const matches = useMatches();
  const navigate = useNavigate();

  // Get page title from the deepest route match that has staticData.pageTitle
  const matchWithTitle = [...matches]
    .reverse()
    .find((match) => (match.staticData as { pageTitle?: string })?.pageTitle);
  const pageTitle = (matchWithTitle?.staticData as { pageTitle?: string })?.pageTitle;

  // Render simple layout for unauthenticated users
  if (!user) {
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
                navigate({ to: '/' });
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

  // Render sidebar layout for authenticated routes
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          {pageTitle && (
            <>
              <div className="h-4 w-px bg-border" />
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
