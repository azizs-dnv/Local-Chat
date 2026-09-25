@echo off
cd /d "%~dp0"
title LocalShare Admin GUI

if not exist ".venv" (
    echo Setting up the Python environment...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)

echo Starting the LocalShare admin GUI...
python main.py
pause
