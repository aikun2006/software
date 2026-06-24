@echo off
chcp 65001 >nul
setlocal
set "BASE_DIR=%~dp0"
set "CF=%BASE_DIR%cloudflared.exe"

rem 先确认本地 server.py（8080）已启动 —— 隧道需要把外网流量转发给它
netstat -ano | findstr :8080 | findstr LISTENING >nul
if errorlevel 1 (
  echo [warn] 本地服务器(8080)未运行！请先双击“启动服务器.vbs”启动 server.py。
  echo [warn] 没有转发目标，公网网址打开会是空白或错误。
  pause
  exit /b 1
)

if not exist "%CF%" (
  echo [error] 未找到 cloudflared.exe: %CF%
  pause
  exit /b 1
)

echo [info] 正在创建 Cloudflare 公网隧道...
echo [info] 注意：每次重启，公网网址都会变化。
echo [info] 等下方出现形如 https://xxx.trycloudflare.com 的网址即可复制分享。
echo [info] 关闭本窗口 = 停止隧道。
echo.
"%CF%" tunnel --url http://localhost:8080

echo.
echo [info] 隧道已停止。
pause
endlocal
