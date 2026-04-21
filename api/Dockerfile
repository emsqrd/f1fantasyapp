# Use the official .NET 10 runtime as the base image for production
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

# Use the .NET 10 SDK for building the application
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS deps
WORKDIR /src

# Copy the project file and restore dependencies
COPY F1CompanionApi/F1CompanionApi.csproj F1CompanionApi/
RUN dotnet restore "F1CompanionApi/F1CompanionApi.csproj"

# Copy the rest of the source code
COPY . .
WORKDIR /src/F1CompanionApi

# Publish the application
FROM deps AS publish
RUN dotnet publish "F1CompanionApi.csproj" -c Release --no-restore -o /app/publish /p:UseAppHost=false

# Build the EF migrations bundle
FROM deps AS migrate
RUN dotnet tool install --global dotnet-ef --version 10.* \
    && /root/.dotnet/tools/dotnet-ef migrations bundle --self-contained -r linux-x64 -o /app/efbundle

# Final stage - create the runtime image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
COPY --from=migrate /app/efbundle ./efbundle

# Set environment variables for production
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080

# Run as the non-root user baked into the .NET base image
USER $APP_UID

CMD ["dotnet", "F1CompanionApi.dll"]
