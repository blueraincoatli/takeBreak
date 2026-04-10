# TakeBreak silent launcher
# Must unset ELECTRON_RUN_AS_NODE to enable Electron mode
$env:ELECTRON_RUN_AS_NODE = ''
$ws = New-Object -ComObject WScript.Shell
$ws.Run('cmd /c set ELECTRON_RUN_AS_NODE= && cd /d D:\takeBreak && start "" node_modules\electron\dist\electron.exe .', 0, $false)
