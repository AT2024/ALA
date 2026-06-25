<#
.SYNOPSIS
    Install (or update) the daily docker-cleanup cron job on the Azure production VM.

.DESCRIPTION
    One-time setup. Installs a crontab entry that runs deployment/docker-cleanup.sh daily at
    10:00 UTC (~13:00 Israel — while the team is awake; the prune is non-disruptive so user
    traffic time is irrelevant for a worldwide app).

    Uses `az vm run-command` (Azure management plane + guest agent), exactly like
    Deploy-Prod.ps1 — no SSH, no NSG change. The cleanup SCRIPT itself reaches the VM via the
    normal `git pull` that swarm-deploy already does, so deploy at least once before/after
    installing so /home/azureuser/ala-improved/deployment/docker-cleanup.sh exists.

    Idempotent: re-running replaces the existing cleanup line instead of duplicating it.

.NOTES
    Prereq: az CLI + az login (same account as Deploy-Prod.ps1). See Deploy-Prod.ps1 header.
#>
[CmdletBinding()]
param(
    [string]$Subscription  = '4b4a2b73-9c46-4a66-a176-a24dca625ba7',  # Alpha Tau Medical - Azure Subscription
    [string]$ResourceGroup = 'ATM-ISR-Docker',
    [string]$VmName        = 'ALAapp'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host '[cron] Azure CLI (az) is not installed. winget install --exact --id Microsoft.AzureCLI' -ForegroundColor Red
    exit 1
}
az account show -o none 2>$null
if ($LASTEXITCODE -ne 0) { az login -o none; if ($LASTEXITCODE -ne 0) { Write-Host '[cron] az login failed.' -ForegroundColor Red; exit 1 } }

# Remote payload (LF, no BOM) — make script executable, ensure log dir, install cron idempotently.
$remote = @'
set -e
SCRIPT=/home/azureuser/ala-improved/deployment/docker-cleanup.sh
LOG=/home/azureuser/ala-improved/logs/docker-cleanup.log
mkdir -p /home/azureuser/ala-improved/logs
[ -f "$SCRIPT" ] || { echo "ERROR: $SCRIPT not found — deploy first (git pull on VM)"; exit 1; }
chmod +x "$SCRIPT"
LINE="0 10 * * *  $SCRIPT >> $LOG 2>&1"
( crontab -l 2>/dev/null | grep -vF 'docker-cleanup.sh'; echo "$LINE" ) | crontab -
echo "Installed crontab:"
crontab -l | grep docker-cleanup.sh
'@ -replace "`r`n", "`n"

$payload = "runuser -l azureuser -c " + "'" + ($remote -replace "'", "'\''") + "'`n"
$tmp = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmp, $payload, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "[cron] Installing daily cleanup cron on $VmName via az vm run-command..." -ForegroundColor Cyan
try {
    $message = az vm run-command invoke `
        --subscription $Subscription --resource-group $ResourceGroup --name $VmName `
        --command-id RunShellScript --scripts "@$tmp" `
        --query "value[0].message" -o tsv --only-show-errors
    $rc = $LASTEXITCODE
} finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host '----- VM output ---------------------------------------------------'
Write-Host $message
Write-Host '-------------------------------------------------------------------'

if ($rc -ne 0) { Write-Host "[cron] Failed (exit $rc)." -ForegroundColor Red; exit 1 }
Write-Host '[cron] Done. The job runs daily at 10:00 UTC.' -ForegroundColor Green
