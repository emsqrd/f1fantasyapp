import { useNavDestinations } from '@/hooks/useNavDestinations';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';

export function MobileBottomNav() {
  const destinations = useNavDestinations();

  return (
    // Height carries the home-indicator inset so the bar's background reaches the
    // screen edge, while the matching bottom padding keeps the tabs above it.
    <nav
      aria-label="Primary"
      className="bg-background fixed inset-x-0 bottom-0 z-40 h-(--bottom-nav-space) border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex h-full items-stretch px-1.5 pt-1.5 pb-0.5">
        {destinations.map((dest) => (
          <li key={dest.key} className="flex-1">
            {/* exact: Link's default prefix match would make Home (`/`) active
                everywhere and light a tab on detail pages (e.g. /league/$id) */}
            <Link
              to={dest.to}
              activeOptions={{ exact: true }}
              className="flex h-full min-h-11.5 flex-col items-center justify-center gap-1 py-1"
            >
              {({ isActive }) => (
                <>
                  <dest.icon
                    strokeWidth={isActive ? 2.3 : 2}
                    className={cn(
                      'size-6 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10.5px] leading-none whitespace-nowrap transition-colors',
                      isActive ? 'text-primary font-semibold' : 'text-muted-foreground font-medium',
                    )}
                  >
                    {dest.short}
                  </span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
