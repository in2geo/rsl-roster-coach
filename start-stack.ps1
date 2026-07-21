<#
  start-stack.ps1 — launch (or stop/restart/status) the 4 dev-box background services:

    app          node server.js                              → http://localhost:3000
    reader       RslBattleReader.exe (Release, watch mode)   → captures battles to battle-log.json
    watcher      tools/watch-reconcile.mjs                   → grades each capture into run_reconciliations
    profilesync  tools/auto-profile-sync.mjs                 → Gestal accounts → signed-in Supabase profiles

  Usage (from the repo root, or anywhere — it locates itself):
    .\start-stack.ps1            # ensure all 4 are up; starts only the ones that are down
    .\start-stack.ps1 -Status    # show what's running, no changes
    .\start-stack.ps1 -Restart   # stop all, then start a fresh single instance of each
    .\start-stack.ps1 -Stop      # stop all 4 (and the sync child process)

  SINGLE-INSTANCE by design: it never starts a second copy of a service that's already
  running. Two readers produce duplicate grades; two auto-profile-syncs double-upload —
  both are guarded here. Each service's combined output goes to <name>.log (stderr to
  <name>.err.log) in the repo root.
#>
param(
  [switch]$Stop,
  [switch]$Restart,
  [switch]$Status
)

$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
Set-Location $repo

$readerExe = Join-Path $repo 'gestal-sync\RslBattleReader\bin\Release\net10.0-windows\win-x64\RslBattleReader.exe'

# Each service: how to START it (File+Args), how to FIND it (regex on the process command line),
# and its log basename. `Extra` lists additional command-line patterns to kill on Stop (the
# profilesync daemon spawns `gestal-sync/sync.js --watch`, which must be stopped with it).
$services = @(
  [pscustomobject]@{ Name='app';         File='node';     Args=@('server.js');                                           Match='server\.js';        Log='server';             Extra=@() }
  [pscustomobject]@{ Name='reader';      File=$readerExe; Args=@();                                                      Match='RslBattleReader';   Log='reader-stdout';      Extra=@() }
  [pscustomobject]@{ Name='watcher';     File='node';     Args=@('--env-file=.env.local','tools/watch-reconcile.mjs');   Match='watch-reconcile';   Log='watch-reconcile';    Extra=@() }
  [pscustomobject]@{ Name='profilesync'; File='node';     Args=@('--env-file=.env.local','tools/auto-profile-sync.mjs'); Match='auto-profile-sync'; Log='auto-profile-sync';  Extra=@('gestal-sync[\\/]sync\.js') }
)

function Find-Procs([string]$pattern) {
  # Win32_Process carries the full command line; match on it so we find node processes by script.
  Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='RslBattleReader.exe'" |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match $pattern) }
}

function Stop-Svc($s) {
  $patterns = @($s.Match) + $s.Extra
  $killed = 0
  foreach ($p in $patterns) {
    foreach ($proc in (Find-Procs $p)) {
      try { Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop; $killed++ } catch {}
    }
  }
  if ($killed) { Write-Host ("  [stopped] {0} ({1} process(es))" -f $s.Name, $killed) -ForegroundColor Yellow }
  else         { Write-Host ("  [-]       {0} was not running" -f $s.Name) -ForegroundColor DarkGray }
}

function Start-Svc($s) {
  $running = Find-Procs $s.Match | Select-Object -First 1
  if ($running) {
    Write-Host ("  [up]      {0} already running (pid {1})" -f $s.Name, $running.ProcessId) -ForegroundColor DarkGray
    return
  }
  if ($s.File -like '*RslBattleReader.exe' -and -not (Test-Path $s.File)) {
    Write-Host ("  [ERR]     {0}: exe not found — build it (dotnet build -c Release)" -f $s.Name) -ForegroundColor Red
    return
  }
  $out = Join-Path $repo ("{0}.log"     -f $s.Log)
  $err = Join-Path $repo ("{0}.err.log" -f $s.Log)
  $params = @{
    FilePath               = $s.File
    WorkingDirectory       = $repo
    RedirectStandardOutput = $out
    RedirectStandardError  = $err
    WindowStyle            = 'Hidden'
    PassThru               = $true
  }
  if ($s.Args.Count) { $params.ArgumentList = $s.Args }
  $p = Start-Process @params
  Write-Host ("  [started] {0} (pid {1}) → {2}" -f $s.Name, $p.Id, (Split-Path $out -Leaf)) -ForegroundColor Green
}

function Show-Status {
  Write-Host "`nStatus:" -ForegroundColor Cyan
  foreach ($s in $services) {
    $procs = Find-Procs $s.Match
    if ($procs) {
      $pids = ($procs | ForEach-Object { $_.ProcessId }) -join ', '
      $flag = if ($procs.Count -gt 1) { ' ⚠ MULTIPLE — expected 1' } else { '' }
      Write-Host ("  {0,-12} UP   pid {1}{2}" -f $s.Name, $pids, $flag) -ForegroundColor Green
    } else {
      Write-Host ("  {0,-12} down" -f $s.Name) -ForegroundColor DarkGray
    }
  }
}

Write-Host "RSL dev stack  ($repo)" -ForegroundColor Cyan

if ($Status) { Show-Status; return }

if ($Stop -or $Restart) {
  Write-Host "`nStopping:" -ForegroundColor Cyan
  foreach ($s in $services) { Stop-Svc $s }
  if ($Stop) { Show-Status; return }
  Start-Sleep -Milliseconds 800   # let ports/log handles release before restarting
}

Write-Host "`nStarting (only what's down):" -ForegroundColor Cyan
foreach ($s in $services) { Start-Svc $s }
Start-Sleep -Milliseconds 1200
Show-Status
Write-Host "`nLogs: <name>.log in the repo root (stderr → <name>.err.log). App: http://localhost:3000" -ForegroundColor DarkGray
