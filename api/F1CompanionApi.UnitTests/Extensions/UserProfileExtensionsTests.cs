using F1CompanionApi.Data.Entities;
using F1CompanionApi.Extensions;

namespace F1CompanionApi.UnitTests.Extensions;

public class UserProfileExtensionsTests
{
    [Fact]
    public void GetFullName_BothNamesProvided_ReturnsCombinedName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = "John",
            LastName = "Doe"
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("John Doe", result);
    }

    [Fact]
    public void GetFullName_OnlyFirstName_ReturnsFirstName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = "John",
            LastName = null
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("John", result);
    }

    [Fact]
    public void GetFullName_OnlyLastName_ReturnsLastName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = null,
            LastName = "Doe"
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("Doe", result);
    }

    [Fact]
    public void GetFullName_BothNamesNull_ReturnsEmptyString()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = null,
            LastName = null
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("", result);
    }

    [Fact]
    public void GetFullName_BothNamesWhitespace_ReturnsEmptyString()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = "   ",
            LastName = "   "
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("", result);
    }

    [Fact]
    public void GetFullName_FirstNameWhitespace_ReturnsLastName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = "   ",
            LastName = "Doe"
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("Doe", result);
    }

    [Fact]
    public void GetFullName_LastNameWhitespace_ReturnsFirstName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = "John",
            LastName = "   "
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("John", result);
    }

    [Fact]
    public void GetFullName_NamesWithExtraWhitespace_ReturnsProperlySpacedName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = "  John  ",
            LastName = "  Doe  "
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("John Doe", result);
    }

    [Fact]
    public void GetFullName_EmptyStrings_ReturnsEmptyString()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = "",
            LastName = ""
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("", result);
    }

    [Fact]
    public void GetFullName_FirstNameEmptyLastNameProvided_ReturnsLastName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = "",
            LastName = "Doe"
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("Doe", result);
    }

    [Fact]
    public void GetFullName_CompoundNames_ReturnsCombinedName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            FirstName = "Mary Jane",
            LastName = "Watson-Parker"
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("Mary Jane Watson-Parker", result);
    }

    [Fact]
    public void GetFullName_BothNamesNull_FallsBackToDisplayName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            DisplayName = "CoolRacer99",
            FirstName = null,
            LastName = null
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("CoolRacer99", result);
    }

    [Fact]
    public void GetFullName_BothNamesEmpty_FallsBackToDisplayName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            DisplayName = "SpeedDemon",
            FirstName = "",
            LastName = ""
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("SpeedDemon", result);
    }

    [Fact]
    public void GetFullName_BothNamesWhitespace_FallsBackToDisplayName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            DisplayName = "F1Fan",
            FirstName = "   ",
            LastName = "   "
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("F1Fan", result);
    }

    [Fact]
    public void GetFullName_PrefersFullNameOverDisplayName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            DisplayName = "CoolRacer99",
            FirstName = "John",
            LastName = "Doe"
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("John Doe", result);
    }

    [Fact]
    public void GetFullName_OnlyFirstName_PrefersFirstNameOverDisplayName()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            DisplayName = "CoolRacer99",
            FirstName = "John",
            LastName = null
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("John", result);
    }

    [Fact]
    public void GetFullName_AllNamesNull_ReturnsEmptyString()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            DisplayName = null,
            FirstName = null,
            LastName = null
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("", result);
    }

    [Fact]
    public void GetFullName_DisplayNameWhitespace_ReturnsEmptyString()
    {
        // Arrange
        var profile = new UserProfile
        {
            AccountId = "test-123",
            Email = "test@example.com",
            DisplayName = "   ",
            FirstName = null,
            LastName = null
        };

        // Act
        var result = profile.GetFullName();

        // Assert
        Assert.Equal("", result);
    }
}
