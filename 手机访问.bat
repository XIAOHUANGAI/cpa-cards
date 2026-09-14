@echo off
chcp 65001 >nul
cd /d "%~dp0"
title CPA 考点速记卡 - 手机访问服务器
echo.
echo   正在启动本地服务器，请保持此窗口开启...
echo   手机请连接与电脑相同的 WiFi，然后浏览器打开下方网址。
echo.
node server.js
echo.
echo   服务已停止，按任意键关闭窗口...
pause >nul
