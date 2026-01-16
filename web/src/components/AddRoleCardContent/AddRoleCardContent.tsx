import { CirclePlus } from 'lucide-react';

import { Button } from '../ui/button';

export function AddRoleCardContent({
  onOpenSheet,
  role,
}: {
  onOpenSheet: () => void;
  role: string;
}) {
  return (
    <Button
      onClick={onOpenSheet}
      variant="ghost"
      className="flex items-center gap-2 !bg-transparent"
    >
      <CirclePlus />
      Add {role}
    </Button>
  );
}
