using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.UnitTests.Domain.Models;

public class WeekendSessionsTests
{
    [Fact]
    public void InOrder_Standard_ReturnsQualifyingThenGrandPrix()
    {
        var sessions = WeekendSessions.InOrder(WeekendFormat.Standard);

        Assert.Equal(new[] { SessionType.Qualifying, SessionType.GrandPrix }, sessions.ToArray());
    }

    [Fact]
    public void InOrder_Sprint_ReturnsSprintThenQualifyingThenGrandPrix()
    {
        var sessions = WeekendSessions.InOrder(WeekendFormat.Sprint);

        Assert.Equal(
            new[] { SessionType.Sprint, SessionType.Qualifying, SessionType.GrandPrix },
            sessions.ToArray()
        );
    }
}
