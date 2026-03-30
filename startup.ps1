# TakeBreak silent launcher
$ws = New-Object -ComObject WScript.Shell
$ws.Run('cmd /c cd /d D:\takeBreak && npm start', 0, $false)
