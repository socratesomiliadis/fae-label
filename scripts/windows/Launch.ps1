$ErrorActionPreference = 'Stop'
$env:DOTNET_ENVIRONMENT = 'Production'
$env:ASPNETCORE_ENVIRONMENT = 'Production'
Add-Type -AssemblyName System.Windows.Forms
$root = $PSScriptRoot
$mutex = New-Object System.Threading.Mutex($false, 'Local\FaethonLauncher')
$locked = $false
try {
    try { $locked = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { exit }
    if (!(Test-Path "$root\configured")) { throw 'Initial setup is not complete. Ask the installer to run Configure.ps1 once.' }
    $logs = Join-Path $root 'logs'
    New-Item -ItemType Directory -Force $logs | Out-Null
    $url = 'http://localhost:5080'
    function Ready {
        try {
            $result = Invoke-RestMethod "$url/api/setup" -TimeoutSec 2
            return ($null -ne $result.required -and $result.required -is [bool])
        } catch { return $false }
    }
    if (!(Ready)) {
        $probe = New-Object System.Net.Sockets.TcpClient
        $busy = $false
        try { $probe.Connect('127.0.0.1', 5080); $busy = $true } catch {} finally { $probe.Dispose() }
        if ($busy) { throw 'The application port is busy but the app is not responding. Wait a moment and try again, or ask support to check it. No second copy was started.' }
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $process = Start-Process "$root\api\Faethon.Api.exe" -WorkingDirectory "$root\api" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$logs\api-$stamp.log" -RedirectStandardError "$logs\api-$stamp-error.log"
        $ready = $false
        for ($i = 0; $i -lt 30; $i++) {
            if (Ready) { $ready = $true; break }
            if ($process.HasExited) { break }
            Start-Sleep -Seconds 1
        }
        if (!$ready) { throw "The app could not connect to its database or start. Ask support to check the PostgreSQL service and logs in $logs." }
    }
    $agentConfig = Get-Content "$root\print-agent\appsettings.json" -Raw | ConvertFrom-Json
    if ($agentConfig.DispatchEnabled) {
        if ([string]::IsNullOrWhiteSpace($agentConfig.Token)) { throw 'Printing is enabled but the printer helper has not been paired. Ask support to configure its token.' }
        $agentPath = Join-Path $root 'print-agent\Faethon.PrintAgent.exe'
        $running = Get-Process -Name 'Faethon.PrintAgent' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $agentPath }
        if (!$running) {
            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            Start-Process $agentPath -WorkingDirectory "$root\print-agent" -WindowStyle Hidden -RedirectStandardOutput "$logs\printer-$stamp.log" -RedirectStandardError "$logs\printer-$stamp-error.log"
        }
    }
    Start-Process $url
} catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Faethon - Unable to open', 'OK', 'Error') | Out-Null
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
