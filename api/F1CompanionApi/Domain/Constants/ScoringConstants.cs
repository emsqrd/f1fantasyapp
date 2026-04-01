using System.Collections.Frozen;

namespace F1CompanionApi.Domain.Constants;

public static class ScoringConstants
{
    public static readonly FrozenDictionary<int, int> QualifyingPositionPoints = new Dictionary<
        int,
        int
    >
    {
        [1] = 10,
        [2] = 9,
        [3] = 8,
        [4] = 7,
        [5] = 6,
        [6] = 5,
        [7] = 4,
        [8] = 3,
        [9] = 2,
        [10] = 1,
    }.ToFrozenDictionary();

    public static readonly FrozenDictionary<int, int> SprintPositionPoints = new Dictionary<
        int,
        int
    >
    {
        [1] = 8,
        [2] = 7,
        [3] = 6,
        [4] = 5,
        [5] = 4,
        [6] = 3,
        [7] = 2,
        [8] = 1,
    }.ToFrozenDictionary();

    public static readonly FrozenDictionary<int, int> RacePositionPoints = new Dictionary<int, int>
    {
        [1] = 25,
        [2] = 18,
        [3] = 15,
        [4] = 12,
        [5] = 10,
        [6] = 8,
        [7] = 6,
        [8] = 4,
        [9] = 2,
        [10] = 1,
    }.ToFrozenDictionary();

    public const int SprintFastestLapBonus = 2;
    public const int RaceFastestLapBonus = 3;
    public const int SprintDnfPenalty = -5;
    public const int RaceDnfPenalty = -10;
    public const int CaptainMultiplier = 2;

    public static int GetPositionPoints(FrozenDictionary<int, int> pointsByPosition, int position)
    {
        return pointsByPosition.TryGetValue(position, out var points) ? points : 0;
    }
}
