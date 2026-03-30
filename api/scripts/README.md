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
F1_SUPABASE_URL=http://127.0.0.1:54321
F1_SUPABASE_ANON_KEY=<local-anon-key>
F1_IMPORT_EMAIL=admin@local.example.com
F1_IMPORT_PASSWORD=<local-password>
F1_API_URL=http://localhost:5000
```

### Production

```ini
# .env.prod
F1_SUPABASE_URL=https://cfuccajsckqzecbfyqrv.supabase.co
F1_SUPABASE_ANON_KEY=<prod-anon-key>
F1_IMPORT_EMAIL=admin@example.com
F1_IMPORT_PASSWORD=<prod-password>
F1_API_URL=https://f1fantasyapp.fly.dev
```

Both `.env.local` and `.env.prod` are gitignored.

## Usage

```bash
# Local (default)
python3 ingest_results.py --year 2026 --round 1

# Production
python3 ingest_results.py --year 2026 --round 1 --env prod
```

The script will:

1. Authenticate with Supabase to get a JWT
2. Fetch the driver list from the API to map abbreviations to IDs
3. Fetch the race list to find the race ID and sprint status
4. Load qualifying results from FastF1 and submit them
5. If sprint weekend: load sprint results + overtakes and submit them
6. Load race results + overtakes and submit them
