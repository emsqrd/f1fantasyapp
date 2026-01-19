using System.Diagnostics.CodeAnalysis;

namespace F1CompanionApi.Api.Endpoints;

public static class Endpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGroup("/api")
        .MapConstructorEndpoints()
        .MapDriverEndpoints()
        .MapLeagueEndpoints()
        .MapMeEndpoints()
        .MapTeamEndpoints();

        return app;
    }
}
