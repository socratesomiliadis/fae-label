# Development on Windows and macOS

Run all commands from the repository root. The API, React UI, PDF previews and backend tests run natively on both systems. The print helper can be **built** on either system, but running it and testing Windows printer queues requires Windows. Extracting new reports from Microsoft Access also requires Windows and Access; the checked-in extracted assets work on both platforms.

## Prerequisites

- Node.js 22.12+ (Node 24 LTS recommended), including npm.
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0). `global.json` permits newer .NET 10 feature bands. The launcher also detects a repo-local SDK in `.tools/dotnet`.
- Docker Desktop, running with Linux containers, with Docker Compose v2 (`docker compose version`).
- PostgreSQL client tools version 17 or newer (`pg_dump`) for backups and the integration test suite.

On macOS, `brew install libpq` supplies the client tools. The launcher detects both Apple Silicon and Intel Homebrew locations. Install the ARM64 .NET SDK on Apple Silicon, or x64 on Intel.

On Windows, install the PostgreSQL command-line tools and add their `bin` folder to PATH, or set `FAETHON_PG_DUMP` to the full path to `pg_dump.exe`. The original `.tools/postgres/pgsql/bin/pg_dump.exe` is also detected when present. The .NET SDK installer normally adds `dotnet` to PATH; reopen your terminal after installation.

For an optional repo-local .NET installation on macOS:

```sh
mkdir -p .tools
curl -fsSL https://dot.net/v1/dotnet-install.sh -o .tools/dotnet-install.sh
bash .tools/dotnet-install.sh --channel 10.0 --install-dir .tools/dotnet
```

## Start or prepare

These commands are identical in PowerShell and macOS Terminal:

```sh
node scripts/dev.mjs start
```

The launcher checks whether the API port is already occupied, installs frontend dependencies if missing, builds the frontend and solution, starts/reuses this project's PostgreSQL container, applies migrations, seeds configuration, imports legacy artwork once, then runs the API at **http://localhost:5080**. It does not start the printing helper. On the first visit, choose an administrator name and password of at least 12 characters and enter the printed first-run setup key. Later visits use your account.

Ctrl+C stops the API. The database persists in the `faethon-dev_database` Docker volume; local file storage and backup output live in `data/portable`. This local database binds only to loopback on **55440**, separate from the old Windows setup's **55439** and other projects' **5432**. The credentials in `compose.yaml` are for local development only; scheduled backups are disabled.

Other commands:

```sh
node scripts/dev.mjs prepare  # Build, initialize and optionally import; do not start API
node scripts/dev.mjs build    # Build UI and entire .NET solution, no database required
node scripts/dev.mjs test     # Build, start database, run backend and browser tests
node scripts/dev.mjs db       # Start/reuse database only
node scripts/dev.mjs db-stop  # Stop database; preserve its volume
```

Run builds/tests with the API stopped because the frontend build replaces its static files. After dependency changes, run `npm ci` in `src/Web` to synchronize with the committed lockfile. Never copy `node_modules`, `.tools`, `bin`, or `obj` between operating systems. Generated output is ignored by Git.

## Import source data

The private spreadsheets and the previous machine's database are **not in Git**. A new setup starts without those business records. To perform the initial import, set `FAETHON_IMPORT_SOURCE` to a directory containing both `PROIONTA.xlsx` and `SYNTAGES.xlsx`, then run `prepare` or `start`.

macOS:

```sh
export FAETHON_IMPORT_SOURCE="$HOME/Downloads/faethonfiles"
node scripts/dev.mjs prepare
```

Windows PowerShell:

```powershell
$env:FAETHON_IMPORT_SOURCE = Join-Path $HOME 'Downloads/faethonfiles'
node scripts/dev.mjs prepare
```

The launcher records a successful import in `data/portable/initial-import.complete`. Use the application's review/commit import flow for subsequent imports. An explicitly supplied missing workbook is an error. If you restore a database instead, also restore its matching storage assets and preserve/create the import marker to avoid reimporting on startup. Do not delete Docker volumes as a troubleshooting step: they contain saved data.

To carry on with the Windows PC's exact records/accounts/history, transfer a database backup **and** its matching storage assets. Starting the portable workflow does not migrate the old database automatically.

## Tests and configuration

`node scripts/dev.mjs test` runs the full backend suite against disposable `faethon_suite_*` databases, including a real `pg_dump` backup check, then installs Playwright Chromium and runs the browser suite with mocked API responses. Browser tests do not start a dev server or submit printer jobs.

Three real-workbook regression tests are explicitly skipped when the private spreadsheets are absent. Supply `FAETHON_IMPORT_SOURCE` (or put both files in ignored `data/imports`) to enable them. An explicitly configured invalid directory fails the tests rather than silently skipping them. Authorization, concurrency, rendering and other self-contained tests still run without those workbooks.

| Variable | Purpose |
| --- | --- |
| `FAETHON_API_PORT` | API port; default `5080` |
| `FAETHON_DB_PORT` | Compose database host port; default `55440` |
| `FAETHON_PG_DUMP` | Full native `pg_dump` executable path |
| `FAETHON_IMPORT_SOURCE` | Directory containing both private source workbooks |
| `FAETHON_TEST_DATABASE` | Optional test connection settings; test user must be allowed to create/drop databases |
| `SetupToken` | Optional first-run setup key; otherwise randomly generated each start |

For direct `dotnet test tests/Faethon.Tests`, start the database first. The default test connection matches Compose; set `FAETHON_TEST_DATABASE` when using another PostgreSQL instance. Tests generate unique database names. Use a dedicated development database account.

The CI workflow builds the solution and runs self-contained backend/browser tests on macOS and Windows. Database integration and private-workbook tests require the local workflow above.

PDF audit scripts additionally require Python with Pillow, pypdf and reportlab, plus Poppler's `pdftoppm` on PATH. `FAETHON_PDFTOPPM` and `FAETHON_QA_FONT` can override its executable and contact-sheet font. When Calibri is absent, the API uses its bundled, OFL-licensed Carlito fallback. Installed Calibri remains preferred. Compare rendered labels against Windows before physical print acceptance, since installed fonts can affect layout.

## Existing Windows development PC

The original launcher remains available for its existing native PostgreSQL cluster and stored data:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Run-Local.ps1
```

It uses `.tools/pgdata` on port 55439 and `data/local/storage`. Continue using it to access that existing environment, or deliberately transfer its database and assets into the portable workflow. Its default input directory is the current user's `Downloads/faethonfiles`; `-ImportDirectory` overrides it. It does not require Docker. Do not run both APIs on port 5080 simultaneously.

For Windows printing, build/run `src/PrintAgent/Faethon.PrintAgent.csproj` on Windows and follow [the printer setup notes](legacy-printing.md). Cross-compilation on a Mac does not test drivers, queues or physical label output.
