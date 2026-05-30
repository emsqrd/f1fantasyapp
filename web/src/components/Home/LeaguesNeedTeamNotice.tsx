import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Users } from 'lucide-react';

export function LeaguesNeedTeamNotice() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Users />
        </EmptyMedia>
        <EmptyTitle>Leagues unlock with a team</EmptyTitle>
        <EmptyDescription>
          You'll be able to join private leagues with friends or browse public ones.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
