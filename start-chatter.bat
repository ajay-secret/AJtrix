@echo off
REM Start Chatter backend in a new terminal window
start "Chatter Backend" cmd /k "cd /d %~dp0backend && node index.js"

REM Start Chatter frontend in a new terminal window
start "Chatter Frontend" cmd /k "cd /d %~dp0frontend && npm start -- --host 0.0.0.0"

REM Wait a few seconds for servers to start
ping 127.0.0.1 -n 6 > nul

REM Open the frontend in the default browser
start http://192.168.0.105:3000 