namespace F1CompanionApi.Data.Entities;

public class LeagueInvite : UserOwnedEntity
{
    public int LeagueId { get; set; }

    public string? Token { get; set; }

    public League? League { get; set; }
}
