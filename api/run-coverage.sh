#!/bin/bash

# F1 Companion API - Code Coverage Script
# Runs tests with coverage collection and generates an HTML report

# Configuration
TEST_PROJECT="F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj"
COVERAGE_DIR="coverage"
COVERAGE_RESULTS="$COVERAGE_DIR/results"
COVERAGE_REPORT="$COVERAGE_DIR/report"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Running tests with code coverage...${NC}"

# Clean previous coverage results
rm -rf "$COVERAGE_DIR"
mkdir -p "$COVERAGE_RESULTS"

# Run tests with coverage collection
dotnet test "$TEST_PROJECT" \
    --collect:"XPlat Code Coverage" \
    --results-directory "$COVERAGE_RESULTS" \
    --logger "console;verbosity=normal"

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Tests failed or coverage collection encountered issues${NC}"
    exit 1
fi

echo -e "${BLUE}📊 Generating HTML coverage report...${NC}"

# Find the coverage file (it's nested in a GUID folder)
COVERAGE_FILE=$(find "$COVERAGE_RESULTS" -name "coverage.cobertura.xml" | head -n 1)

if [ -z "$COVERAGE_FILE" ]; then
    echo -e "${YELLOW}⚠️  No coverage file found${NC}"
    exit 1
fi

# Generate HTML report with exclusions
dotnet reportgenerator \
    -reports:"$COVERAGE_FILE" \
    -targetdir:"$COVERAGE_REPORT" \
    -reporttypes:"Html;Cobertura;JsonSummary" \
    -classfilters:"-F1CompanionApi.Data.Migrations.*;-F1CompanionApi.Data.Entities.*;-F1CompanionApi.Api.Models.*;-F1CompanionApi.Extensions.ServiceExtensions" \
    -filefilters:"-**/Program.cs;-**/Migrations/**/*.cs;-**/Data/Entities/**/*.cs;-**/Api/Models/**/*.cs;-**/Extensions/ServiceExtensions.cs"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Coverage report generated successfully!${NC}"
    echo -e "${GREEN}📂 Report location: $COVERAGE_REPORT/index.html${NC}"
    
    # Open report in default browser (optional)
    if [ "$1" = "--open" ]; then
        open "$COVERAGE_REPORT/index.html" 2>/dev/null || \
        xdg-open "$COVERAGE_REPORT/index.html" 2>/dev/null || \
        echo -e "${YELLOW}Could not open browser automatically${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Report generation failed${NC}"
    exit 1
fi
