import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Link } from '@tanstack/react-router';
import { Gauge, Search } from 'lucide-react';

export function JoinLeaguesPrompt() {
  return (
    <Empty className="border">
      <EmptyHeader className="max-w-md">
        <EmptyMedia variant="icon">
          <Gauge />
        </EmptyMedia>
        <EmptyTitle>You're riding solo</EmptyTitle>
        <EmptyDescription>You've got the team — now you need a grid.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/browse-leagues">
            <Search />
            Browse leagues
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
