# Run once, as the Windows account that will operate the app.
param([string]$ImportDirectory = '')
$ErrorActionPreference = 'Stop'
$env:DOTNET_ENVIRONMENT = 'Production'
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$root = $PSScriptRoot
if (Test-Path "$root\configured") { throw 'Already configured. See READ-ME.md for updates; configuration and data were not overwritten.' }
$probe = New-Object System.Net.Sockets.TcpClient
$busy = $false
try { $probe.Connect('127.0.0.1', 5080); $busy = $true } catch {} finally { $probe.Dispose() }
if ($busy) { throw 'Close the running Faethon app before initial configuration.' }
$pgDump = Read-Host 'Full path to pg_dump.exe (for example C:\Program Files\PostgreSQL\17\bin\pg_dump.exe)'
if (!(Test-Path -LiteralPath $pgDump)) { throw 'pg_dump.exe was not found.' }
$database = Read-Host 'Database name (created during PostgreSQL setup)'
$username = Read-Host 'Database owner/user name'
$password = Read-Host 'Database password' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
# Connection-string quoting supports semicolons, quotes and spaces in passwords.
function Quote-Value([string]$value) { return '"' + $value.Replace('"', '""') + '"' }
$connection = 'Host=127.0.0.1;Port=5432;Database=' + (Quote-Value $database) + ';Username=' + (Quote-Value $username) + ';Password=' + (Quote-Value $plain)
$plain = $null
$state = Join-Path $root 'state'
New-Item -ItemType Directory -Force $state | Out-Null
$settings = @{
    ConnectionStrings = @{ Database = $connection }
    Storage = "$state\storage"
    Urls = 'http://localhost:5080'
    AllowedHosts = 'localhost;127.0.0.1'
    SetupToken = [Guid]::NewGuid().ToString('N')
    Backup = @{ Enabled = $true; Hour = 16; RetentionDays = 30; Directory = "$state\backups"; PgDump = $pgDump }
    Logging = @{ LogLevel = @{ Default = 'Information'; 'Microsoft.AspNetCore' = 'Warning' } }
}
$settings | ConvertTo-Json -Depth 8 | Set-Content "$root\api\appsettings.Production.json" -Encoding UTF8
# Restrict the package, including credentials, to this Windows user, SYSTEM and Administrators.
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $root /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /T /Q | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict access to configuration. Check folder permissions.' }
Push-Location "$root\api"
try {
    & .\Faethon.Api.exe --initialize
    if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed. Check the database name, owner and password.' }
    & .\Faethon.Api.exe --legacy-assets "$root\legacy"
    if ($LASTEXITCODE -ne 0) { throw 'Artwork import failed.' }
    if ($ImportDirectory) {
        foreach ($name in @('PROIONTA.xlsx', 'SYNTAGES.xlsx')) {
            if (!(Test-Path (Join-Path $ImportDirectory $name))) { throw "Missing $name in the import folder." }
        }
        & .\Faethon.Api.exe --import $ImportDirectory
        if ($LASTEXITCODE -ne 0) { throw 'Workbook import failed.' }
    }
} finally { Pop-Location }
$agent = Get-Content "$root\print-agent\appsettings.json" -Raw | ConvertFrom-Json
$agent.Ledger = "$state\print-ledger"
$agent | ConvertTo-Json -Depth 8 | Set-Content "$root\print-agent\appsettings.json" -Encoding UTF8
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Faethon.lnk'))
$shortcut.TargetPath = "$env:SystemRoot\System32\wscript.exe"
$shortcut.Arguments = '"' + "$root\Launch.vbs" + '"'
$shortcut.WorkingDirectory = $root
$shortcut.Description = 'Open Faethon Labeller'
$shortcut.Save()
'Configured' | Set-Content "$root\configured"
Write-Host "Setup complete. First-run setup key: $($settings.SetupToken)"
Write-Host 'Double-click the Faethon desktop shortcut and create your administrator account.'
Write-Host 'Printing stays disabled until you pair and commission the helper. See READ-ME.md.'
