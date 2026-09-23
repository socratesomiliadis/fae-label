param(
    [switch]$PrepareOnly,
    [string]$ImportDirectory = (Join-Path $HOME 'Downloads/faethonfiles')
)
$ErrorActionPreference = 'Stop'
$probe = New-Object System.Net.Sockets.TcpClient
$portBusy = $false
try { $probe.Connect('127.0.0.1', 5080); $portBusy = $true } catch { } finally { $probe.Dispose() }
if ($portBusy) { throw 'Port 5080 is already in use. Reuse the running app or stop it before preparing another instance.' }
$root = Split-Path $PSScriptRoot -Parent
$dotnet = Join-Path $root '.tools/dotnet/dotnet.exe'
$pgBin = Join-Path $root '.tools/postgres/pgsql/bin'
$pgData = Join-Path $root '.tools/pgdata'
$api = Join-Path $root 'src/Api'
$state = Join-Path $root 'data/local'
foreach ($file in @($dotnet, "$pgBin/pg_ctl.exe", "$pgData/PG_VERSION")) {
    if (!(Test-Path -LiteralPath $file)) { throw "Missing local prerequisite: $file. This launcher is for the prepared development PC." }
}
New-Item -ItemType Directory -Force -Path $state | Out-Null
$names = @('PATH','DOTNET_ROOT','ConnectionStrings__Database','Storage','Urls','SetupToken','Logging__LogLevel__Microsoft','Backup__Enabled','Backup__PgDump','Backup__Directory')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:DOTNET_ROOT = Split-Path $dotnet
    $env:PATH = "$env:DOTNET_ROOT;$env:PATH"
    $env:ConnectionStrings__Database = 'Host=127.0.0.1;Port=55439;Database=faethon_local;Username=faethon_test'
    $env:Storage = Join-Path $state 'storage'
    $env:Urls = 'http://localhost:5080'
    $env:Backup__Enabled = 'false'
    $env:Backup__PgDump = Join-Path $pgBin 'pg_dump.exe'
    $env:Backup__Directory = Join-Path $state 'backups'
    $env:Logging__LogLevel__Microsoft = 'Warning'
    $env:SetupToken = [Guid]::NewGuid().ToString('N')

    & "$pgBin/pg_ctl.exe" status -D $pgData *> $null
    if ($LASTEXITCODE -ne 0) {
        & "$pgBin/pg_ctl.exe" start -D $pgData -l "$state/postgres.log" -o '-p 55439 -h 127.0.0.1' -w -t 30
        if ($LASTEXITCODE -ne 0) { throw 'Could not start the local PostgreSQL database.' }
    }
    $dbExists = & "$pgBin/psql.exe" -h 127.0.0.1 -p 55439 -U faethon_test -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='faethon_local'"
    if ($LASTEXITCODE -ne 0) { throw 'Could not connect to the local PostgreSQL database.' }
    if ($dbExists -ne '1') {
        & "$pgBin/createdb.exe" -h 127.0.0.1 -p 55439 -U faethon_test faethon_local
        if ($LASTEXITCODE -ne 0) { throw 'Could not create faethon_local.' }
    }
    Push-Location (Join-Path $root 'src/Web')
    try {
        if (!(Test-Path -LiteralPath 'node_modules')) {
            & npm.cmd ci
            if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        }
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
    Push-Location $api
    try {
        & $dotnet build --nologo
        if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
        $assembly = Join-Path $api 'bin/Debug/net10.0/Faethon.Api.dll'
        & $dotnet $assembly --initialize
        if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
        $marker = Join-Path $state 'initial-import.complete'
        if (!(Test-Path -LiteralPath $marker)) {
            foreach ($file in @('PROIONTA.xlsx', 'SYNTAGES.xlsx')) {
                if (!(Test-Path -LiteralPath (Join-Path $ImportDirectory $file))) { throw "Missing input: $ImportDirectory/$file" }
            }
            & $dotnet $assembly --import $ImportDirectory
            if ($LASTEXITCODE -ne 0) { throw 'Initial spreadsheet import failed.' }
            & $dotnet $assembly --legacy-assets (Join-Path $root 'legacy')
            if ($LASTEXITCODE -ne 0) { throw 'Fresh legacy asset import failed.' }
            'Imported supplied spreadsheets and fresh legacy assets.' | Set-Content -LiteralPath $marker
        }
        if ($PrepareOnly) {
            Write-Host 'Preparation complete. The web application was not started.'
        } else {
            Write-Host ''
            Write-Host 'Open http://localhost:5080 after the application starts.' -ForegroundColor Green
            Write-Host "First-run setup key: $env:SetupToken" -ForegroundColor Yellow
            Write-Host 'Choose your own administrator name and password (12+ characters).'
            Write-Host 'Keep this window open. Ctrl+C stops the application. The local database stays running.'
            Write-Host 'Local testing only: this PostgreSQL cluster uses loopback trust authentication.'
            & $dotnet $assembly
            if ($LASTEXITCODE -ne 0) { throw "Application exited with code $LASTEXITCODE." }
        }
    } finally { Pop-Location }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process') }
}
