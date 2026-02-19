using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;

namespace F1CompanionApi.Data;

public class ConnectionDiagnosticsInterceptor(ILogger<ConnectionDiagnosticsInterceptor> logger)
    : DbConnectionInterceptor
{
    public override Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default
    )
    {
        var durationMs = eventData.Duration.TotalMilliseconds;
        var (host, port) = GetEndpoint(connection);

        if (durationMs > 1000)
        {
            logger.LogWarning(
                "Slow DB connection {ConnectionId} to {Host}:{Port} opened in {DurationMs:F0}ms",
                eventData.ConnectionId,
                host,
                port,
                durationMs
            );
        }
        else
        {
            logger.LogDebug(
                "DB connection {ConnectionId} to {Host}:{Port} opened in {DurationMs:F0}ms",
                eventData.ConnectionId,
                host,
                port,
                durationMs
            );
        }

        return Task.CompletedTask;
    }

    public override Task ConnectionFailedAsync(
        DbConnection connection,
        ConnectionErrorEventData eventData,
        CancellationToken cancellationToken = default
    )
    {
        var (host, port) = GetEndpoint(connection);

        logger.LogError(
            eventData.Exception,
            "DB connection {ConnectionId} to {Host}:{Port} failed after {DurationMs:F0}ms. State: {ConnectionState}",
            eventData.ConnectionId,
            host,
            port,
            eventData.Duration.TotalMilliseconds,
            connection.State
        );

        return Task.CompletedTask;
    }

    private static (string Host, int Port) GetEndpoint(DbConnection connection)
    {
        if (connection is NpgsqlConnection npgsql)
            return (npgsql.Host ?? "unknown", npgsql.Port);

        return ("unknown", 0);
    }
}
