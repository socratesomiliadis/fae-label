param([string]$Source='C:\Users\Socrates\Downloads\FAETHONLabeller\FAETHON LABELLER.accdb')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$work=Join-Path $root 'legacy/working'
$out=Join-Path $root 'legacy/definitions'
New-Item -ItemType Directory -Force $work,$out | Out-Null
$copy=Join-Path $work 'inspection.accdb'
Copy-Item -LiteralPath $Source -Destination $copy -Force
# Remove the startup form only in the disposable copy. There must be no AutoExec
# macro before launching Runtime, so no application startup code can execute.
$engine=New-Object -ComObject DAO.DBEngine.120
$isolated=$engine.OpenDatabase($copy)
try {
  if(@($isolated.Containers.Item('Scripts').Documents | Where-Object Name -eq 'AutoExec').Count){throw 'AutoExec exists; stop before starting Access.'}
  try{$isolated.Properties.Delete('StartUpForm')}catch{}
} finally {$isolated.Close()}
$app=$null
try {
  Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public static class ExistingAccess {
 [DllImport("oleaut32.dll",PreserveSig=false)] static extern void GetActiveObject(ref Guid id,IntPtr p,[MarshalAs(UnmanagedType.IUnknown)]out object obj);
 public static object Get(){Guid id=new Guid("73A4C9C1-D68D-11D0-98BF-00A0C90DC8D9");object obj;GetActiveObject(ref id,IntPtr.Zero,out obj);return obj;}
}
'@
  $process=Start-Process 'C:/Program Files/Microsoft Office/root/Office16/MSACCESS.EXE' -ArgumentList ('"'+$copy+'" /runtime') -WindowStyle Hidden -PassThru
  for($i=0;$i -lt 110 -and !$app;$i++){try{$candidate=[ExistingAccess]::Get();if($candidate.CurrentProject.FullName -eq $copy){$app=$candidate}}catch{};if(!$app){Start-Sleep -Milliseconds 500}}
  if(!$app){throw "Access Runtime did not register automation; inspect its startup dialog (PID $($process.Id))."}
  try { $app.Visible=$false } catch { } # Runtime may not expose Visible.
  $app.AutomationSecurity=3
  for($i=0;$i -lt 60 -and $app.CurrentProject.FullName -ne $copy;$i++){Start-Sleep -Milliseconds 500}
  if($app.CurrentProject.FullName -ne $copy){throw 'The isolated source database did not open.'}
  $rows=@()
  foreach($report in $app.CurrentProject.AllReports){
    $name=$report.Name
    $app.SaveAsText(3,$name,(Join-Path $out ($name+'.txt')))
    $family='thermal';$profile='small';$mode='product';$brand='FAETHON';$langs=@('el')
    switch -Regex ($name) {
      '^MEGALH_' {$profile='large'}
      '^ETIKETA_PALETA_' {$family='pallet';$profile='a4'}
      '^DEIGMA_' {$family='sample';$profile='small'}
      '^CUSTOM_' {$family='custom';$profile=if($name -match 'MEGALH'){'large'}else{'small'}}
      '^ETIKETES_PELATES$' {$family='address';$profile='small'}
      '^ETIKETES_KENES_PROS_PARAGOGH$' {$family='production';$profile='small'}
      '^TABELAKIA_' {$family='butcher';$profile='small'}
      '^PISTOPOIHTIKA_BG$' {$family='certificate-bg';$profile='a4';$langs=@('bg')}
      '^CERTIFICATE_' {$family='certificate-conformance';$profile='a4';$langs=@('en')}
      '^LISTA_' {$family='reference-list';$profile='a4'}
    }
    if($name -match 'KIBOTIO'){$mode='carton'}
    if($name -match 'KENO|KENES'){$mode='blank'}
    if($name -match '(FAETHON|IONIC|MAVROUDIS|METEORA|PAPADOPOULOS|PASSIAS|SUFRO|ZLATHS)'){$brand=$Matches[1]}
    $map=@{GR='el';EN='en';GE='de';BG='bg';RO='ro';FR='fr';IT='it';ES='es';PL='pl';HL='nl';PO='pt';CH='cs';SW='sv';HU='hu';CR='hr';AL='sq'}
    $found=@($name.Split('_') | Where-Object {$map.ContainsKey($_)} | ForEach-Object {$map[$_]})
    if($found.Count){$langs=$found}
    $rows+=@{report=$name;family=$family;profile=$profile;languages=$langs;brand=$brand;mode=$mode;logo=($name -notmatch 'NOLOGO');status='unvalidated';definitionSha256=(Get-FileHash (Join-Path $out ($name+'.txt'))).Hash}
  }
  if($rows.Count -ne 106){throw "Expected 106 reports; found $($rows.Count). Export is incomplete."}
  $forms=Join-Path $root 'legacy/forms';New-Item -ItemType Directory -Force $forms | Out-Null
  foreach($form in $app.CurrentProject.AllForms){$app.SaveAsText(2,$form.Name,(Join-Path $forms ($form.Name+'.txt')))}
  $rows | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $root 'legacy/coverage.json') -Encoding utf8
  @{sourceSha256=(Get-FileHash -LiteralPath $Source).Hash;extractedAt=[DateTime]::UtcNow.ToString('o');reports=$rows.Count;macrosDisabled=$true} | ConvertTo-Json | Set-Content (Join-Path $root 'legacy/provenance.json')
  # Shared image resources are attachments in the isolated Access system resource table.
  $db=$app.CurrentDb()
  try {
    $rs=$db.OpenRecordset('MSysResources',4)
    $assetDir=Join-Path $root 'legacy/assets';New-Item -ItemType Directory -Force $assetDir | Out-Null
    $index=0
    while(!$rs.EOF){
      try {
        $attachments=$rs.Fields.Item('Data').Value
        while(!$attachments.EOF){
          $index++;$filename=[IO.Path]::GetFileName([string]$attachments.Fields.Item('FileName').Value)
          $attachments.Fields.Item('FileData').SaveToFile((Join-Path $assetDir ("{0:D3}_{1}" -f $index,$filename)))
          $attachments.MoveNext()
        }
        $attachments.Close()
      } catch { Write-Warning "Resource $index could not be extracted: $($_.Exception.Message)" }
      $rs.MoveNext()
    }
    $rs.Close()
  } catch { Write-Warning "Shared resource extraction unavailable: $($_.Exception.Message)" }
  if($db){$db.Close()}
  Write-Output "Extracted $($rows.Count) reports. Originals unchanged."
} finally { if($app){$app.Quit(2);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app)} }
