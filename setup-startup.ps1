$startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$batchFile = "D:\takeBreak\startup.bat"
$shortcutPath = [System.IO.Path]::Combine($startupFolder, "TakeBreak.lnk")

# 创建快捷方式
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $batchFile
$Shortcut.WorkingDirectory = "D:\takeBreak"
$Shortcut.WindowStyle = 7  # 最小化窗口
$Shortcut.Save()

Write-Host "TakeBreak 已添加到开机自启"
Write-Host "快捷方式位置: $shortcutPath"
