# Single Windows 11 PC

Docker is not required. PostgreSQL runs as a native Windows service. The release folder contains the API, built web interface and Windows print helper, including their .NET runtimes. Operators need no Node.js, SDK, terminal, or administrator privileges.

## Build the package on the development computer

Run `node scripts/package-windows.mjs` from the repository root. Requires Node and the .NET 10 SDK, with internet access for dependency restoration. It prints a new `artifacts/windows-*` directory. Copy the **whole directory** to the target PC, for example `C:\Faethon`. The build targets Intel/AMD Windows x64, not native ARM64. It builds web assets separately so the currently running development application's web files are not replaced.

This is a folder deployment, not an MSI installer. No private database, credentials or business spreadsheets are bundled. Do not move the installed folder after configuring it: data paths and the shortcut are absolute.

## One-time setup by the installer

1. Install PostgreSQL **17** with its Windows installer, including command-line tools and pgAdmin. Keep its service configured for automatic startup. Use local connections on port 5432; this PC does not need inbound firewall access. In pgAdmin, create a login role named `faethon` with a strong password and a database named `faethon` owned by that role. It does not need superuser permissions. The PostgreSQL administrator credentials are for setup, not the application.
2. Sign in as the Windows account that will operate the app. Place the release in a local folder that account can write, outside OneDrive and Program Files. The setup restricts that folder to this user, administrators and SYSTEM. This workflow is intended for one Windows account; application accounts can still distinguish operators.
3. Choose the data source before starting. To retain existing records, accounts, configuration and history, restore the app backup's `database.dump` into the database using pgAdmin Restore with **No owner** and **No privileges** selected; the target objects must be owned by `faethon`. Copy the backup's `assets` directory to `C:\Faethon\state\storage\assets`. Keep the source backup unchanged. Restore while the app and helper are stopped. Do not also import the initial spreadsheets after restoring. For a fresh setup, put `PROIONTA.xlsx` and `SYNTAGES.xlsx` in a separate import folder instead.
4. Open PowerShell once, navigate to the installed folder, and run:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Configure.ps1
   ```

   For a fresh workbook import, append `-ImportDirectory 'C:\FaethonImport'`. Enter the PostgreSQL dump executable path, database, owner and password when prompted. Setup initializes the database, imports artwork, enables backups, and creates the **Faethon** desktop shortcut. It refuses to overwrite a completed setup. If setup fails, correct its reported problem and rerun it; initial database/artwork setup is idempotent.
5. Double-click **Faethon**. On an empty database, use the displayed setup key to create the first administrator. Restored databases retain their existing accounts. Create the actual operator accounts in the app.
6. Make a manual backup from Settings, copy it off the PC, and rehearse a restore to a separate database before relying on recovery. Backups include the database and assets; save a separate secure copy of deployment configuration and the print ledger as well.

## Everyday use

Double-click **Faethon** on the desktop. The launcher starts the app invisibly if needed, waits for database readiness and opens the default browser at `http://localhost:5080`. Repeated clicks reuse the running app. Closing the browser leaves the app running; after a reboot, the same shortcut starts it again. The user must remain signed in for background printing and backups. PostgreSQL starts with Windows.

For optional automatic launch at Windows sign-in, copy the desktop shortcut into the folder opened by `shell:startup`. This is not required for double-click use.

Failures appear in a dialog instead of a disappearing terminal. Installer diagnostics are in `logs`. If startup times out, check the PostgreSQL service and logs before trying again; the launcher does not kill processes or attempt database repair. Logs accumulate per start and should be reviewed/rotated during maintenance.

## Printer setup by the installer

Install the appropriate Zebra/Kyocera Windows drivers and confirm that the operating Windows account can print to the queues. In the app's Settings, create a print helper and retain its ID/token. Edit `print-agent\appsettings.json`: set `Token`, set `AllowedQueues` to the exact Windows queue names, and enable `DispatchEnabled` only for controlled commissioning. Assign the helper ID to the app's corresponding printer profiles and configure actual media, DPI and orientation. The next desktop launch starts the enabled helper under the same Windows user. Restart the helper after configuration changes.

Defaults are large Zebra 108 x 148 mm at 90 degrees, small Zebra 100 x 80 mm, and A4. Verify those against the actual stock. Compare previews with approved originals, then perform controlled physical output checks and barcode scans before accepting profiles for operational use. Validation flags are operator/admin acceptance gates, not proof of physical output. Do not send pending jobs blindly after restoring a backup; reconcile the queue and preserve the print ledger before enabling dispatch.

Multi-page documents must be printed through their PDF; the direct helper transport rejects them. A submitted status means acceptance by the spooler, not confirmed physical printing.

## Data, backups and updates

- `state\storage`: live assets. PostgreSQL owns the database in its own installation/data directory, not this folder.
- `state\backups`: automatic database/assets ZIP backups, retained for 30 days. The schedule is 16:00 Athens time while the app is running, with a catch-up after that hour. Copy backups off the PC; local files alone do not protect against PC failure. Set the schedule/path in `api\appsettings.Production.json` if needed.
- `state\print-ledger`: durable print-submission history; preserve it to avoid ambiguous replay.
- `api\appsettings.Production.json`: database password, setup key and local configuration. Do not share this file publicly.
- `print-agent\appsettings.json`: pairing token and printer settings. Preserve it on updates.

Before an update, take a backup, finish/reconcile outstanding print jobs, and stop `Faethon.Api.exe` and `Faethon.PrintAgent.exe` through Task Manager. Retain the previous release for rollback. Replace application binaries/web assets from the new package, preserving both configuration files above, the `state` folder and `configured` marker. From the `api` folder run `Faethon.Api.exe --initialize` once to apply migrations/seeding, then use the desktop shortcut. Do not rerun initial workbook imports. Database schema changes can require restoring the matching pre-update backup when rolling back.

## Acceptance limits

Cross-building this package on macOS does not verify Windows execution, local PostgreSQL installation, driver access or physical output. On the target PC, test first launch, a repeated click, restart after reboot, real product preview, a controlled print/scan, manual backup and restore. Missing catalogue translations/reference data remain separate from installation readiness.
