param(
  [string]$Trigger = 'start here',
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

function Write-RehydrateMessage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  if (-not $Quiet) {
    Write-Host $Message
  }
}

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
$intelScriptRoot = 'C:\dev\_intel\scripts'
$resolveScript = Join-Path $intelScriptRoot 'Resolve-AgentContext.ps1'
$restoreScript = Join-Path $intelScriptRoot 'Build-RestoreAnchor.ps1'
$recallScript = Join-Path $intelScriptRoot 'Resolve-RoutedRecall.ps1'

if (-not (Test-Path -LiteralPath $resolveScript)) {
  Write-RehydrateMessage 'Local intel workspace not found on this machine.'
  Write-RehydrateMessage 'Fallback: read AGENTS.md, docs/control/docs-index.md, docs/product.md, and docs/core-flows.md before deeper work.'
  exit 0
}

& $resolveScript -TargetPath $repoRoot -Profile 'operator-fast' -Quiet | Out-Null

if (Test-Path -LiteralPath $restoreScript) {
  & $restoreScript -TargetPath $repoRoot -Profile 'operator-fast' -Quiet | Out-Null
}

if (-not [string]::IsNullOrWhiteSpace($Trigger) -and (Test-Path -LiteralPath $recallScript)) {
  & $recallScript -TargetPath $repoRoot -Trigger $Trigger -Profile 'operator-fast' -Quiet | Out-Null
}

$runtimeRoot = 'C:\dev\_intel\ops\local-machine-ops'
$contextPath = Join-Path $runtimeRoot 'context-resolutions\holdfast\latest.md'
$restorePath = Join-Path $runtimeRoot 'restore-anchors\holdfast\operator-fast\latest.md'
$recallPath = Join-Path $runtimeRoot 'recall-resolutions\holdfast\operator-fast\latest.md'
$checkpointPath = Join-Path $runtimeRoot 'checkpoints\holdfast\latest.md'
$driftPath = Join-Path $runtimeRoot 'drift-reports\holdfast\latest.md'
$externalContextPath = Join-Path $runtimeRoot 'external-context\holdfast\latest.md'
$externalContextInbox = 'C:\dev\_intel\incoming-context\holdfast\pending'

Write-RehydrateMessage 'Holdfast agent context refreshed.'
Write-RehydrateMessage ('Target: {0}' -f $repoRoot)

foreach ($path in @($contextPath, $restorePath, $recallPath, $checkpointPath, $driftPath, $externalContextPath)) {
  if (Test-Path -LiteralPath $path) {
    Write-RehydrateMessage ('- {0}' -f $path)
  }
}

if (-not (Test-Path -LiteralPath $externalContextPath)) {
  Write-RehydrateMessage ('- external context inbox: {0}' -f $externalContextInbox)
}
