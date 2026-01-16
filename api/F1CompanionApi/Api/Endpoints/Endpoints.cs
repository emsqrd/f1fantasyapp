namespace F1CompanionApi.Api.Endpoints;

public static class Endpoints
{
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
