# Reads a JSON setup request on stdin. The PostgreSQL password never appears in argv.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$data = $env:FAETHON_DATA_DIR
$resources = $env:FAETHON_RESOURCE_DIR
if (!$data -or !$resources) { throw 'Desktop setup paths are missing.' }
$bin = [IO.Path]::GetFullPath($request.pgBin)
foreach ($name in @('psql.exe', 'pg_dump.exe')) {
    if (!(Test-Path -LiteralPath (Join-Path $bin $name))) { throw "PostgreSQL 17 command-line tool missing: $name" }
}
if (!$request.adminPassword) { throw 'Enter the PostgreSQL administrator password.' }
if ($request.importDirectory) {
    foreach ($name in @('PROIONTA.xlsx', 'SYNTAGES.xlsx')) {
        if (!(Test-Path -LiteralPath (Join-Path $request.importDirectory $name))) { throw "Missing $name in the selected folder." }
    }
}
function Sql([string]$statement) {
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = Join-Path $bin 'psql.exe'
    $start.Arguments = '-X -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -At'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['PGPASSWORD'] = $request.adminPassword
    $start.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '10'
    $process = [Diagnostics.Process]::Start($start)
    try {
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.WriteLine($statement)
        $process.StandardInput.Close()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { throw ('PostgreSQL: ' + $errors.Result) }
        return $output.Result.Trim()
    } finally { $process.Dispose() }
}
function Quoted([string]$value) { return '"' + $value.Replace('"', '""') + '"' }
New-Item -ItemType Directory -Force $data | Out-Null
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $data /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /T /Q | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not secure the Faethon data folder.' }
$pendingPath = Join-Path $data 'setup-pending.json'
if (Test-Path $pendingPath) {
    $pending = Get-Content $pendingPath -Raw | ConvertFrom-Json
    $secure = $pending.Password | ConvertTo-SecureString
} else {
    $existing = Sql "SELECT 1 WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname='faethon_label') OR EXISTS (SELECT 1 FROM pg_database WHERE datname='faethon_label');"
    if ($existing) { throw 'The faethon_label role or database already exists. Fresh setup will not overwrite it.' }
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secure = ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force
    @{ Password = ($secure | ConvertFrom-SecureString) } | ConvertTo-Json | Set-Content $pendingPath -Encoding UTF8
}
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
if (!(Sql "SELECT 1 FROM pg_roles WHERE rolname='faethon_label';")) {
    $literal = "'" + $plain.Replace("'", "''") + "'"
    Sql "CREATE ROLE faethon_label LOGIN PASSWORD $literal;" | Out-Null
}
if (!(Sql "SELECT 1 FROM pg_database WHERE datname='faethon_label';")) { Sql 'CREATE DATABASE faethon_label OWNER faethon_label;' | Out-Null }
$connection = 'Host=127.0.0.1;Port=5432;Database=faethon_label;Username=faethon_label;Password=' + (Quoted $plain)
$plain = $null
$api = @{
    ConnectionStrings = @{ Database = $connection }
    Storage = (Join-Path $data 'storage')
    Urls = 'http://127.0.0.1:5080'
    AllowedHosts = 'localhost;127.0.0.1'
    SetupToken = [Guid]::NewGuid().ToString('N')
    Backup = @{ Enabled = $true; Hour = 16; RetentionDays = 30; Directory = (Join-Path $data 'backups'); PgDump = (Join-Path $bin 'pg_dump.exe') }
}
$apiPath = Join-Path $data 'api.json'
if (!(Test-Path $apiPath)) { $api | ConvertTo-Json -Depth 8 | Set-Content $apiPath -Encoding UTF8 }
$agentPath = Join-Path $data 'agent.json'
if (!(Test-Path $agentPath)) {
    @{ Backend = 'http://127.0.0.1:5080'; Token = ''; Ledger = (Join-Path $data 'print-ledger'); AllowedQueues = @(); DispatchEnabled = $false } | ConvertTo-Json -Depth 8 | Set-Content $agentPath -Encoding UTF8
}
$env:DOTNET_ENVIRONMENT = 'Production'
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$exe = Join-Path $resources 'api\Faethon.Api.exe'
& $exe --initialize
if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
& $exe --legacy-assets (Join-Path $resources 'legacy')
if ($LASTEXITCODE -ne 0) { throw 'Artwork import failed.' }
if ($request.importDirectory -and !(Test-Path (Join-Path $data 'initial-import.complete'))) {
    & $exe --import $request.importDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Spreadsheet import failed.' }
    'Complete' | Set-Content (Join-Path $data 'initial-import.complete')
}
Remove-Item $pendingPath -ErrorAction SilentlyContinue
$saved = Get-Content $apiPath -Raw | ConvertFrom-Json
@{ setupToken = $saved.SetupToken } | ConvertTo-Json -Compress
