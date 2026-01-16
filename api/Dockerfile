# Use the official .NET 9 runtime as the base image for production
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

# Use the .NET 9 SDK for building the application
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy the project file and restore dependencies
COPY F1CompanionApi/F1CompanionApi.csproj F1CompanionApi/
RUN dotnet restore "F1CompanionApi/F1CompanionApi.csproj"

# Copy the rest of the source code
COPY . .
WORKDIR "/src/F1CompanionApi"

# Build the application
RUN dotnet build "F1CompanionApi.csproj" -c Release -o /app/build

# Publish the application
FROM build AS publish
RUN dotnet publish "F1CompanionApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Final stage - create the runtime image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Set environment variables for production
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080

# Create a non-root user for security
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /app
USER appuser

ENTRYPOINT ["dotnet", "F1CompanionApi.dll"]