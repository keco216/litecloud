# LiteCloud Shell Overlay Registration Script
# Run as Administrator!

$ErrorActionPreference = "Stop"

# Create HKCR drive if it doesn't exist
if (-not (Test-Path "HKCR:")) {
    New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT | Out-Null
}

# Find DLL
$Locations = @(
    "$env:LOCALAPPDATA\LiteCloud\overlay\litecloud_overlay.dll",
    (Join-Path $PSScriptRoot "target\release\litecloud_overlay.dll"),
    (Join-Path $PSScriptRoot "litecloud_overlay.dll")
)
$DllPath = $null
foreach ($loc in $Locations) {
    if (Test-Path $loc) { $DllPath = $loc; break }
}
if (-not $DllPath) {
    Write-Error "DLL not found!"
    exit 1
}

$DllPath = (Resolve-Path $DllPath).Path
Write-Host "Registering DLL: $DllPath"

$Overlays = @(
    @{ Name = " LiteCloudSynced";  CLSID = "{4C1FE2A1-B3D4-4F5E-9A1B-C2D3E4F5A6B7}"; Desc = "LiteCloud Synced" },
    @{ Name = " LiteCloudSyncing"; CLSID = "{4C1FE2A2-B3D4-4F5E-9A1B-C2D3E4F5A6B8}"; Desc = "LiteCloud Syncing" },
    @{ Name = " LiteCloudError";   CLSID = "{4C1FE2A3-B3D4-4F5E-9A1B-C2D3E4F5A6B9}"; Desc = "LiteCloud Error" }
)

foreach ($ov in $Overlays) {
    # Register CLSID in HKCR
    $ClsidPath = "HKCR:\CLSID\$($ov.CLSID)"
    New-Item -Path $ClsidPath -Force | Out-Null
    Set-ItemProperty -Path $ClsidPath -Name "(Default)" -Value $ov.Desc

    $InprocPath = "$ClsidPath\InProcServer32"
    New-Item -Path $InprocPath -Force | Out-Null
    Set-ItemProperty -Path $InprocPath -Name "(Default)" -Value $DllPath
    Set-ItemProperty -Path $InprocPath -Name "ThreadingModel" -Value "Apartment"

    # Register overlay handler in HKLM
    $OverlayPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\ShellIconOverlayIdentifiers\$($ov.Name)"
    New-Item -Path $OverlayPath -Force | Out-Null
    Set-ItemProperty -Path $OverlayPath -Name "(Default)" -Value $ov.CLSID

    Write-Host "  OK: $($ov.Name)"
}

Write-Host ""
Write-Host "Done! Now restart Explorer:"
Write-Host "  taskkill /f /im explorer.exe; Start-Process explorer.exe"
