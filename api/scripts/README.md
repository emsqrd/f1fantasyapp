# F1 Results Import Script

Fetches real F1 results from FastF1 and submits them to the Fantasy API.

## Setup

```bash
cd api/scripts
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configuration

Copy `.env.example` to `.env.local` and/or `.env.prod` and fill in the values:

```bash
cp .env.example .env.local
cp .env.example .env.prod
```

### Local

```ini
# .env.local
F1_API_KEY=<local-api-key>
F1_API_URL=http://localhost:5000
```

### Production

```ini
# .env.prod
F1_API_KEY=<prod-api-key>
F1_API_URL=https://f1fantasyapp.fly.dev
```

Both `.env.local` and `.env.prod` are gitignored.

## Usage

```bash
cd api/scripts
source .venv/bin/activate

# Local (default)
python3 ingest_results.py --round 1

# Production
python3 ingest_results.py --round 1 --env prod
```

The script will:

1. Fetch the current season from the API to determine the year and season ID
2. Fetch the driver list from the API to map abbreviations to IDs
3. Fetch race weekends to find the round and sprint status
4. Verify the race date has passed (refuses to run for future races)
5. Load qualifying results from FastF1 and submit them
6. If sprint weekend: load sprint results, overtakes, and fastest lap and submit them
7. Load race results, overtakes, and fastest lap and submit them

## Tests

```bash
cd api/scripts
source .venv/bin/activate
python3 -m pytest test_ingest_results.py
```
