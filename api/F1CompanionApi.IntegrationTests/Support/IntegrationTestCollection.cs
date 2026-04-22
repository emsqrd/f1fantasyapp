namespace F1CompanionApi.IntegrationTests.Support;

/// <summary>
/// xUnit collection binding PostgresFixture so the container is shared across all
/// integration test classes in this project.
/// </summary>
[CollectionDefinition(Name)]
public class IntegrationTestCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Integration Tests";
}
