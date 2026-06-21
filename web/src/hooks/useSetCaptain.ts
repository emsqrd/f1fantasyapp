import type { Team } from '@/contracts/Team';
import { setCaptain, teamQueries } from '@/services/teamService';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useSetCaptain() {
  const queryClient = useQueryClient();
  const myTeamKey = teamQueries.mine().queryKey;

  return useMutation({
    mutationFn: setCaptain,
    onMutate: async (driverId) => {
      await queryClient.cancelQueries({ queryKey: myTeamKey });
      const previous = queryClient.getQueryData<Team | null>(myTeamKey);
      queryClient.setQueryData<Team | null>(myTeamKey, (team) =>
        team
          ? { ...team, drivers: team.drivers.map((d) => ({ ...d, isCaptain: d.id === driverId })) }
          : team,
      );
      return { previous };
    },
    onError: (_err, _driverId, context) => {
      queryClient.setQueryData(myTeamKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: myTeamKey }),
  });
}
