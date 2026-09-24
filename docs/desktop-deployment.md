# Faethon Windows desktop release

This is the Electron deployment for one signed-in Windows 11 operator. The desktop installer contains the React UI, self-contained .NET API, and Windows print helper. PostgreSQL 17 remains a separate native Windows service. The API and print helper run in the operator session while Faethon is open or in the tray.

## Build an installer

Use Windows x64 with Node 24 and the .NET 10 SDK. The default feed is `https://faethon-updates.sohub.digital/faethon/`; set `FAETHON_UPDATE_URL` only for a staging feed. Update `src/Desktop/package.json` to the desired semantic version and create a matching `vX.Y.Z` Git tag. Run:

```powershell
$env:FAETHON_RELEASE_TAG = 'v0.1.0'
node scripts/package-desktop.mjs
```

The installer, `latest.yml`, and blockmap appear in `artifacts/desktop-release`. The tagged GitHub Actions workflow runs backend tests and builds the same release as a downloadable artifact. It **does not publish** it. Publishing the reviewed artifact through the Coolify-hosted publisher is the release approval step.

The first release is unsigned. Windows SmartScreen can warn on installation, and an unsigned update relies on the HTTPS feed and its administrator controls for authenticity. Arrange Windows code signing before distributing more broadly.

## Install on the Windows PC

Run `Faethon-Setup-VERSION-x64.exe` as the operator account. The installer adds desktop and Start menu shortcuts without needing administrator access. First launch opens setup:

1. Install PostgreSQL **17** with command-line tools on local port 5432. The PostgreSQL installer may require administrator approval. Remember the `postgres` password.
2. In Faethon, confirm the PostgreSQL `bin` directory, enter that password, and optionally select a directory containing `PROIONTA.xlsx` and `SYNTAGES.xlsx`.
3. Select **Set up Faethon**. Setup creates the `faethon_label` role and database, initializes schema and artwork, stores application settings in `%LOCALAPPDATA%\Faethon`, and displays the first administrator setup key.
4. Open Faethon and create the administrator account. In Settings, create a print helper and copy its token. Open **Printer and connection settings** from the Faethon tray icon, enter the token and exact Windows queue names, then enable dispatch after checking printer drivers and media.
5. Test a label preview, a controlled print and scan, and a manual backup. Copy a backup off the PC and rehearse a restore before relying on recovery.

Closing the window leaves Faethon in the tray for printing and scheduled backups. **Quit** from the tray stops both managed processes. Start-at-sign-in is enabled by default on fresh setup and can be changed in desktop settings or the tray. Windows sign-out stops the app. PostgreSQL continues as its own service.

The data directory contains `desktop.json`, `api.json` (database credential and setup key), `agent.json` (pairing token), `storage`, `backups`, `print-ledger`, and `logs`. Preserve this directory on reinstall or update. Windows ACLs restrict it to the operating user, administrators, and SYSTEM. The installer and update feed contain no business records or credentials.

## Host the update feed with Coolify

1. Point an `A` record for `faethon-updates.sohub.digital` to the Hetzner deployment server. In Coolify create a Git-based application from this repository, set **Base Directory** to `/deploy/updates`, choose Dockerfile build, and set **Dockerfile Location** to `/Dockerfile`. Set its exposed port to `8080` and its domain to `https://faethon-updates.sohub.digital` so Coolify provisions TLS.
2. Add a persistent **volume mount** at `/data` in Coolify before first deployment. The publisher keeps staged uploads and old installers there across redeployments.
3. Set a secret `FAETHON_PUBLISH_TOKEN` environment variable in Coolify to a random value of at least 32 characters. Restrict who can edit the Coolify application or read this secret. Deploy the application and open `https://faethon-updates.sohub.digital/admin`.
4. Download the reviewed `faethon-windows-release` CI artifact or use the local `artifacts/desktop-release` directory. Enter the publishing token in the admin page and select the **one** `Faethon-Setup-...-x64.exe`, its `.blockmap` if generated, and `latest.yml` from the same build. Upload, then click **Publish reviewed release**. The service verifies the installer's SHA-512 against `latest.yml`, moves package files into the public feed, and replaces `latest.yml` last. It retains prior installers for rollback.
5. Confirm `https://faethon-updates.sohub.digital/faethon/latest.yml` and its installer URL return HTTP 200 before requesting an update on the PC.

The app checks at launch and every six hours. It downloads a new release and asks the operator when to install. Installation waits for the print helper to finish its current cycle before stopping it. In local mode it checks for active jobs, creates a database/assets backup, stops the API, and restarts into the new version. A failed backup blocks the update. Database migrations run before the updated local UI opens. Keep the prior installer and pre-update backup; a schema rollback may require restoring that backup. In remote mode, server backup and migration belong to the separate server release procedure.

## Later remote backend

The tray's **Printer and connection settings** can switch to a trusted HTTPS backend URL. In remote mode Electron loads the server UI/API as one origin and the local print helper polls that same backend. The local API does not start. Each PC retains its own print token, queue allowlist, and ledger. Before switching production, deploy the API and PostgreSQL on Coolify with persistent asset storage and off-server backups, restore a tested local backup, reconcile outstanding print jobs, and assign each printer to its PC's helper. Server application releases then have a separate migration and rollback procedure from desktop releases.

## Acceptance checks

On a clean Windows 11 PC, verify initial setup, a second launch, tray operation, sign-in startup, real printing, backup/restore, an update from a published feed, offline use, and interrupted-download retry. Verify a staging remote backend and print helper before the two-PC rollout. The release build and automated tests do not substitute for those physical checks.
