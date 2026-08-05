@echo off
cd /d "%~dp0.."
set DJANGO_SETTINGS_MODULE=config.settings.local
venv\Scripts\python.exe -m daphne -b 0.0.0.0 -p 8000 config.asgi:application
pause
