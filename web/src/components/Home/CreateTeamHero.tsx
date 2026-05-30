import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';

export function CreateTeamHero() {
  return (
    <section className="bg-card rounded-[0.65rem] border p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-foreground text-xl font-bold tracking-tight md:text-2xl">
            Get on the grid
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Pick 5 drivers and 2 constructors with a $100M budget. Set a captain to earn 2× points
            on their race score.
          </p>
        </div>
        <Button asChild size="lg" className="w-full md:w-auto">
          <Link to="/create-team">Create team</Link>
        </Button>
      </div>
    </section>
  );
}
