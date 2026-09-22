@echo off
title Qevrix Guardian - AI Pipeline Worker
echo ========================================================
echo   QEVRIX GUARDIAN - AI PIPELINE BACKGROUND DAEMON WORKER
echo ========================================================
echo.
echo Checking Python environment...
python --version
echo.
echo Starting worker process (polling esp32-detections bucket)...
python -u python-backend/main.py
echo.
pause
