# Double-click Setup.cmd. No shell commands or pgAdmin operations are needed.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$root = $PSScriptRoot
$mutex = New-Object Threading.Mutex($false, 'Local\FaethonSetup')
$locked = $false

function Sql-Literal([string]$value) { return "'" + $value.Replace("'", "''") + "'" }
function Run-Sql([string]$bin, [string]$secret, [string]$sql) {
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = Join-Path $bin 'psql.exe'
    $start.Arguments = '-X -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -At'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables['PGPASSWORD'] = $secret
    $start.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '10'
    $process = [Diagnostics.Process]::Start($start)
    try {
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.WriteLine("SET standard_conforming_strings = on;`n" + $sql)
        $process.StandardInput.Close()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { throw ('PostgreSQL: ' + $errors.Result) }
        return $output.Result
    } finally { $process.Dispose() }
}

try {
    try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { throw 'Setup is already open. Use the existing setup window.' }
    if (Test-Path "$root\configured") {
        [Windows.Forms.MessageBox]::Show('This installation is already configured. Use the Faethon desktop shortcut. Your configuration and data have been kept.', 'Faethon Setup') | Out-Null
        exit
    }
    foreach ($file in @('api\Faethon.Api.exe', 'print-agent\Faethon.PrintAgent.exe', 'Configure.ps1')) {
        if (!(Test-Path (Join-Path $root $file))) { throw 'Extract the complete release folder before running setup.' }
    }
    $form = New-Object Windows.Forms.Form
    $form.Text = 'Faethon - First-time setup'
    $form.ClientSize = New-Object Drawing.Size(620, 620)
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.Font = New-Object Drawing.Font('Segoe UI', 10)
    function Label([string]$text, [int]$y, [int]$height = 25) {
        $control = New-Object Windows.Forms.Label
        $control.Text = $text; $control.SetBounds(20, $y, 580, $height)
        $form.Controls.Add($control)
    }
    function Input-Box([int]$y, [string]$text = '') {
        $control = New-Object Windows.Forms.TextBox
        $control.Text = $text; $control.SetBounds(20, $y, 470, 28)
        $form.Controls.Add($control)
        return $control
    }
    function Button([string]$text, [int]$x, [int]$y, [int]$width = 100) {
        $control = New-Object Windows.Forms.Button
        $control.Text = $text; $control.SetBounds($x, $y, $width, 30)
        $form.Controls.Add($control)
        return $control
    }
    Label "Install location: $root" 15 40
    Label '1. PostgreSQL 17 must be installed on this PC (default port 5432).' 58
    $download = Button 'Get PostgreSQL' 20 86 170
    $download.Add_Click({ Start-Process 'https://www.postgresql.org/download/windows/' })
    Label 'Finish its installer first. Remember the postgres password, then return here.' 122 42
    Label 'PostgreSQL bin folder (contains psql.exe and pg_dump.exe)' 164
    $detected = Join-Path $env:ProgramFiles 'PostgreSQL\17\bin'
    $bin = Input-Box 192 $detected
    $browseBin = Button 'Browse...' 500 191
    $browseBin.Add_Click({
        $picker = New-Object Windows.Forms.FolderBrowserDialog
        if ($picker.ShowDialog() -eq 'OK') { $bin.Text = $picker.SelectedPath }
        $picker.Dispose()
    })
    Label '2. PostgreSQL administrator password (user: postgres)' 232
    $passwordBox = Input-Box 260
    $passwordBox.UseSystemPasswordChar = $true
    Label 'Setup creates a dedicated faethon_label database and a random app password.' 298 42
    Label '3. Optional spreadsheet folder (leave blank to import later in the app)' 340
    $imports = Input-Box 368
    $browseImport = Button 'Browse...' 500 367
    $browseImport.Add_Click({
        $picker = New-Object Windows.Forms.FolderBrowserDialog
        if ($picker.ShowDialog() -eq 'OK') { $imports.Text = $picker.SelectedPath }
        $picker.Dispose()
    })
    $startup = New-Object Windows.Forms.CheckBox
    $startup.Text = 'Open Faethon automatically when I sign into Windows'
    $startup.SetBounds(20, 410, 580, 30)
    $form.Controls.Add($startup)
    Label 'Use this for a fresh installation. To transfer an existing app database, follow READ-ME.md instead. Existing databases will not be replaced.' 450 55
    $status = New-Object Windows.Forms.Label
    $status.SetBounds(20, 510, 580, 55)
    $form.Controls.Add($status)
    $install = Button 'Set up Faethon' 390 575 210
    $install.Add_Click({
        try {
            $install.Enabled = $false
            $status.Text = 'Checking prerequisites...'
            $form.Refresh()
            $pgBin = $bin.Text.Trim()
            foreach ($tool in @('psql.exe', 'pg_dump.exe')) {
                if (!(Test-Path (Join-Path $pgBin $tool))) { throw 'Install PostgreSQL with command-line tools, or select its correct bin folder.' }
            }
            if (!$passwordBox.Text) { throw 'Enter the postgres password chosen in the PostgreSQL installer.' }
            if ($imports.Text.Trim()) {
                foreach ($file in @('PROIONTA.xlsx', 'SYNTAGES.xlsx')) {
                    if (!(Test-Path (Join-Path $imports.Text.Trim() $file))) { throw "The spreadsheet folder must contain $file." }
                }
            }
            $probe = New-Object Net.Sockets.TcpClient
            $busy = $false
            try { $probe.Connect('127.0.0.1', 5080); $busy = $true } catch {} finally { $probe.Dispose() }
            if ($busy) { throw 'The app port is in use. Close the running app before initial setup.' }
            # Restrict credentials before writing any resumable setup configuration.
            $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
            & icacls.exe $root /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /T /Q | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'This Windows user must be able to write to the extracted folder. Place it in a local folder owned by this user.' }
            $pendingPath = Join-Path $root 'setup-pending.json'
            if (Test-Path $pendingPath) {
                $pending = Get-Content $pendingPath -Raw | ConvertFrom-Json
                $appPassword = $pending.Password | ConvertTo-SecureString
            } else {
                $exists = Run-Sql $pgBin $passwordBox.Text "SELECT 'EXISTS' WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname='faethon_label') OR EXISTS (SELECT 1 FROM pg_database WHERE datname='faethon_label');"
                if ($exists -match 'EXISTS') { throw 'A faethon_label database or role already exists. Setup has not changed it. Follow READ-ME.md to configure an existing database.' }
                $bytes = New-Object byte[] 32
                $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
                try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
                $appPassword = ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force
                # DPAPI binds retry credentials to this Windows account; no password in command arguments.
                @{ Password = ($appPassword | ConvertFrom-SecureString) } | ConvertTo-Json | Set-Content $pendingPath -Encoding UTF8
            }
            $status.Text = 'Creating the database and initializing Faethon. This can take a few minutes...'
            $form.Refresh()
            $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($appPassword)
            try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
            $roleExists = Run-Sql $pgBin $passwordBox.Text "SELECT 'EXISTS' FROM pg_roles WHERE rolname='faethon_label';"
            if ($roleExists -notmatch 'EXISTS') {
                Run-Sql $pgBin $passwordBox.Text ('CREATE ROLE faethon_label LOGIN PASSWORD ' + (Sql-Literal $plain) + ';') | Out-Null
            }
            $plain = $null
            $dbExists = Run-Sql $pgBin $passwordBox.Text "SELECT 'EXISTS' FROM pg_database WHERE datname='faethon_label';"
            if ($dbExists -notmatch 'EXISTS') {
                Run-Sql $pgBin $passwordBox.Text 'CREATE DATABASE faethon_label OWNER faethon_label;' | Out-Null
            }
            $passwordBox.Clear()
            & "$root\Configure.ps1" -PgDump (Join-Path $pgBin 'pg_dump.exe') -Database 'faethon_label' -Username 'faethon_label' -Password $appPassword -ImportDirectory $imports.Text.Trim() -StartAtLogin:$startup.Checked
            Remove-Item $pendingPath
            $settings = Get-Content "$root\api\appsettings.Production.json" -Raw | ConvertFrom-Json
            $status.Text = 'Setup complete. Use the Faethon desktop shortcut.'
            $install.Text = 'Completed'
            $keyForm = New-Object Windows.Forms.Form
            $keyForm.Text = 'Faethon is ready'; $keyForm.ClientSize = New-Object Drawing.Size(540, 190); $keyForm.StartPosition = 'CenterParent'
            $message = New-Object Windows.Forms.Label
            $message.Text = 'Copy this setup key. Use it in the browser to create your administrator account. Keep this window open until you finish.'
            $message.SetBounds(20, 20, 500, 55); $keyForm.Controls.Add($message)
            $key = New-Object Windows.Forms.TextBox
            $key.Text = $settings.SetupToken; $key.ReadOnly = $true; $key.SetBounds(20, 85, 500, 28); $keyForm.Controls.Add($key)
            $open = New-Object Windows.Forms.Button
            $open.Text = 'Open Faethon'; $open.SetBounds(340, 135, 180, 32); $keyForm.Controls.Add($open)
            $open.Add_Click({ Start-Process "$root\Launch.vbs" })
            $keyForm.ShowDialog($form) | Out-Null
            $form.Close()
        } catch {
            $status.Text = 'Setup did not finish. Correct the issue and click Set up Faethon again.'
            [Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Faethon Setup', 'OK', 'Error') | Out-Null
            $install.Enabled = $true
        }
    })
    $form.ShowDialog() | Out-Null
} catch {
    [Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Faethon Setup', 'OK', 'Error') | Out-Null
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
