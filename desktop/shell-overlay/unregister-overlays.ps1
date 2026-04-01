# LiteCloud Shell Overlay Unregistration Script
# Run as Administrator!

$ErrorActionPreference = "SilentlyContinue"

$Names = @(" LiteCloudSynced", " LiteCloudSyncing", " LiteCloudError")
$CLSIDs = @(
    "{4C1FE2A1-B3D4-4F5E-9A1B-C2D3E4F5A6B7}",
    "{4C1FE2A2-B3D4-4F5E-9A1B-C2D3E4F5A6B8}",
    "{4C1FE2A3-B3D4-4F5E-9A1B-C2D3E4F5A6B9}"
)

foreach ($name in $Names) {
    Remove-Item -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\ShellIconOverlayIdentifiers\$name" -Recurse -Force
    Write-Host "Removed overlay: $name"
}

foreach ($clsid in $CLSIDs) {
    Remove-Item -Path "HKCR:\CLSID\$clsid" -Recurse -Force
    Write-Host "Removed CLSID: $clsid"
}

Write-Host ""
Write-Host "Done! Restart Explorer: taskkill /f /im explorer.exe && start explorer.exe"
