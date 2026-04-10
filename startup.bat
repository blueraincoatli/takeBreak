@echo off
REM TakeBreak launcher
REM Must unset ELECTRON_RUN_AS_NODE to enable Electron mode
set ELECTRON_RUN_AS_NODE=
cd /d D:\takeBreak
start "" "node_modules\electron\dist\electron.exe" .
