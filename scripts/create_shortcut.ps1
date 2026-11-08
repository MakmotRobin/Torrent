$desktopPath = [Environment]::GetFolderPath("Desktop")
$projectPath = "D:\Desktop\StudioProjects\Torrent"
$electronExe = Join-Path $projectPath "node_modules\electron\dist\electron.exe"
$iconPath = Join-Path $projectPath "assets\icon.ico"

$WshShell = New-Object -ComObject WScript.Shell

# 1. Shortcut on Desktop
$desktopShortcutPath = Join-Path $desktopPath "Torrent.lnk"
$Shortcut = $WshShell.CreateShortcut($desktopShortcutPath)
$Shortcut.TargetPath = $electronExe
$Shortcut.Arguments = "`"$projectPath`""
$Shortcut.WorkingDirectory = $projectPath
$Shortcut.IconLocation = "$iconPath,0"
$Shortcut.Description = "uTorrent-style Torrent Desktop App"
$Shortcut.Save()
Write-Host "Created Desktop shortcut: $desktopShortcutPath"

# 2. Shortcut in Project Directory
$projectShortcutPath = Join-Path $projectPath "Torrent.lnk"
$ProjectShortcut = $WshShell.CreateShortcut($projectShortcutPath)
$ProjectShortcut.TargetPath = $electronExe
$ProjectShortcut.Arguments = "`"$projectPath`""
$ProjectShortcut.WorkingDirectory = $projectPath
$ProjectShortcut.IconLocation = "$iconPath,0"
$ProjectShortcut.Description = "uTorrent-style Torrent Desktop App"
$ProjectShortcut.Save()
Write-Host "Created Project shortcut: $projectShortcutPath"
