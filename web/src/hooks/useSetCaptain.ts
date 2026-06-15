import type { Team } from '@/contracts/Team';
import { myTeamQuery, setCaptain } from '@/services/teamService';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useSetCaptain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setCaptain,
    onMutate: async (driverId) => {
      await queryClient.cancelQueries({ queryKey: myTeamQuery.queryKey });
      const previous = queryClient.getQueryData<Team | null>(myTeamQuery.queryKey);
      queryClient.setQueryData<Team | null>(myTeamQuery.queryKey, (team) =>
        team
          ? { ...team, drivers: team.drivers.map((d) => ({ ...d, isCaptain: d.id === driverId })) }
          : team,
      );
      return { previous };
    },
    onError: (_err, _driverId, context) => {
      queryClient.setQueryData(myTeamQuery.queryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: myTeamQuery.queryKey }),
  });
}
