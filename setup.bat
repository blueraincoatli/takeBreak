@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   TakeBreak - 安装脚本
echo ========================================
echo.

set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

echo [1/2] 安装依赖（淘宝镜像）...
call npm install --registry=https://registry.npmmirror.com/
if errorlevel 1 (
    echo.
    echo [!] 自动安装失败。手动方案：
    echo   1. 浏览器打开 https://npmmirror.com/mirrors/electron/
    echo   2. 下载 electron-v35.7.5-win32-x64.zip
    echo   3. 放到 %%LOCALAPPDATA%%\electron\Cache\
    echo   4. 重新运行此脚本
    pause
    exit /b 1
)

echo.
echo [2/2] 验证安装...
node -e "try{require('electron');console.log('[OK] Electron ready')}catch(e){console.log('[FAIL] '+e.message);process.exit(1)}"
if errorlevel 1 (
    pause
    exit /b 1
)

echo.
echo ========================================
echo   安装完成！
echo.
echo   启动:  npm start
echo   触发:  curl --noproxy localhost http://localhost:3721/heartbeat
echo   状态:  curl --noproxy localhost http://localhost:3721/health
echo ========================================
