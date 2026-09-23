# Run on this development PC

Open PowerShell and run:

```powershell
cd D:\Projects\playground\fae-label
powershell -ExecutionPolicy Bypass -File .\scripts\Run-Local.ps1
```

Wait for startup, then open **http://localhost:5080**. On the first visit, choose an administrator username and a password of at least 12 characters, and paste the **First-run setup key** shown in PowerShell. On later runs, use that username and password; no setup key is needed.

Leave PowerShell open while using the app. Press **Ctrl+C** to stop the app. Start it again with the same command; your saved data remains. Do not launch a second instance on the same port.

The launcher uses the workspace's .NET 10 SDK and PostgreSQL binaries, builds the frontend and backend, applies database migrations, and imports the supplied spreadsheets and freshly extracted assets once. It does not start Vite or a print helper. The separate `faethon_local` database uses port 55439; files live in `data/local/storage`. Subsequent imports should use the application's review/commit workflow rather than deleting the first-import marker.

To prepare/build without starting the web application:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Run-Local.ps1 -PrepareOnly
```

This is a development/testing build, not a commissioned production installation. Some workflows and legacy output configurations still need completion and validation. Missing business data may block label output. Printer profiles remain unvalidated and the helper is not started, so exploring the application will not print labels.

The existing local PostgreSQL cluster uses trust authentication on loopback, and automatic backups are disabled in this local launcher. Do not expose this setup to the network or use it as the production deployment. The eventual two-PC installation needs authenticated PostgreSQL, server configuration, backups and printer acceptance.
