<#
.SYNOPSIS
    Deploy ALA to the Azure production VM from any network, without SSH or NSG changes.

.DESCRIPTION
    Runs the VM's existing deployment/swarm-deploy script via `az vm run-command invoke`.
    This goes through Azure's management plane (outbound HTTPS) + the VM guest agent, so it
    never opens inbound port 22 and works regardless of which WiFi/IP you are on. The NSG
    stays untouched.

    Everyday flow:
        git push origin main          # swarm-deploy pulls origin/main on the VM
        .\deployment\Deploy-Prod.ps1  # runs the deploy on the VM

.PARAMETER Force
    Skip the interactive production confirmation prompt.

.PARAMETER SkipBuild
    Pass --skip-build to swarm-deploy (redeploy existing images, no rebuild).

.PARAMETER Subscription
    Azure subscription that holds the VM. Defaults to "Alpha Tau Medical - Azure Subscription"
    (the prod VM is NOT in the default "GitHub" subscription).

.PARAMETER ResourceGroup
    Azure resource group of the VM.

.PARAMETER VmName
    Azure VM name.

.NOTES
    ONE-TIME SETUP (per machine):
      1. winget install --exact --id Microsoft.AzureCLI   (restart shell afterwards)
      2. az login                                          (browser SSO, same account as the NSG portal)
      3. Confirm permission with the dry-run probe below.

    If you are on a machine without the Azure CLI, open Azure Cloud Shell
    (https://shell.azure.com, Bash) and run the same `az vm run-command invoke` line.

    DRY-RUN PROBE (proves the channel works, deploys nothing):
      az vm run-command invoke --subscription "Alpha Tau Medical - Azure Subscription" `
        -g ATM-ISR-Docker -n ALAapp --command-id RunShellScript `
        --scripts "runuser -l azureuser -c 'whoami && docker ps --format {{.Names}}'" `
        --query "value[0].message" -o tsv
#>
[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$SkipBuild,
    [string]$Subscription  = '4b4a2b73-9c46-4a66-a176-a24dca625ba7',  # Alpha Tau Medical - Azure Subscription
    [string]$ResourceGroup = 'ATM-ISR-Docker',
    [string]$VmName        = 'ALAapp'
)

$ErrorActionPreference = 'Stop'

$HealthUrl = 'https://ala-app.israelcentral.cloudapp.azure.com/api/health'

function Write-Info { param($m) Write-Host "[deploy] $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[deploy] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[deploy] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[deploy] $m" -ForegroundColor Red }

# --- 1. Azure CLI present? -------------------------------------------------
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Err 'Azure CLI (az) is not installed.'
    Write-Host '  Install it once with:  winget install --exact --id Microsoft.AzureCLI'
    Write-Host '  Then restart this shell and run az login.'
    Write-Host '  (No-install alternative: run the same az command in Azure Cloud Shell.)'
    exit 1
}

# --- 2. Logged in? ---------------------------------------------------------
az account show -o none 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Info 'Not logged in to Azure. Launching az login...'
    az login -o none
    if ($LASTEXITCODE -ne 0) { Write-Err 'az login failed.'; exit 1 }
}
$subName = az account show --query name -o tsv
Write-Info "Azure subscription: $subName"

# --- 3. Target VM ----------------------------------------------------------
Write-Info "Target VM: $VmName  (resource group: $ResourceGroup)"

# --- 4. Production confirmation --------------------------------------------
if (-not $Force) {
    Write-Warn 'This deploys to the LIVE production medical system.'
    $answer = Read-Host "Type 'yes' to continue"
    if ($answer -ne 'yes') { Write-Info 'Aborted.'; exit 1 }
}

# --- 5. Build the remote script and run it via run-command -----------------
# Write to a temp file (LF, no BOM) and pass with --scripts @file to avoid
# PowerShell -> az.cmd -> bash quoting problems.
$deployArgs = if ($SkipBuild) { ' --skip-build' } else { '' }
$remote = "runuser -l azureuser -c 'cd ~/ala-improved/deployment && ./swarm-deploy$deployArgs'`n"
$tmp = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmp, $remote, (New-Object System.Text.UTF8Encoding($false)))

Write-Info 'Running swarm-deploy on the VM via az vm run-command (this takes ~2-4 min)...'
try {
    $message = az vm run-command invoke `
        --subscription $Subscription `
        --resource-group $ResourceGroup `
        --name $VmName `
        --command-id RunShellScript `
        --scripts "@$tmp" `
        --query "value[0].message" -o tsv --only-show-errors
    $rc = $LASTEXITCODE
}
finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host '----- VM output ---------------------------------------------------'
Write-Host $message
Write-Host '-------------------------------------------------------------------'
Write-Host ''

if ($rc -ne 0) {
    Write-Err "az vm run-command failed (exit $rc). See output above."
    exit 1
}

# --- 6. Independent health confirmation over the public URL (any network) --
Write-Info "Confirming health at $HealthUrl ..."
$healthy = $false
for ($i = 1; $i -le 6; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 10 -UseBasicParsing
        if ($resp.StatusCode -eq 200) { $healthy = $true; break }
    } catch {
        Write-Info "  attempt $i/6 - not ready yet..."
    }
    Start-Sleep -Seconds 5
}

if ($healthy) {
    Write-Ok 'Production is healthy. Deployment complete.'
    exit 0
} else {
    Write-Err "Health check at $HealthUrl did not pass. Investigate the VM output above."
    exit 1
}
