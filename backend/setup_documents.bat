@echo off
REM Backend Setup Script for Document Upload Feature

echo.
echo ========================================
echo Student Document Upload - Setup Script
echo ========================================
echo.

REM Check if we're in backend directory
if not exist "manage.py" (
    echo ERROR: manage.py not found. Please run this from the backend directory.
    exit /b 1
)

echo [1/4] Creating migrations for StudentDocument model...
python manage.py makemigrations students
if errorlevel 1 (
    echo ERROR: makemigrations failed
    exit /b 1
)
echo ✓ Migrations created

echo.
echo [2/4] Applying migrations to database...
python manage.py migrate students
if errorlevel 1 (
    echo ERROR: migrate failed
    exit /b 1
)
echo ✓ Migrations applied

echo.
echo [3/4] Checking media folder...
if not exist "media" (
    mkdir media
    echo ✓ Media folder created
) else (
    echo ✓ Media folder already exists
)

echo.
echo [4/4] Verifying setup...
python manage.py shell -c "from students.models import StudentDocument; print('✓ StudentDocument model verified')" 2>nul
if errorlevel 1 (
    echo WARNING: Could not verify StudentDocument model
) else (
    echo ✓ Model verification passed
)

echo.
echo ========================================
echo ✅ Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Start Django server: daphne -b 0.0.0.0 -p 8000 config.asgi:application
echo 2. Open frontend: http://localhost:3000/students/add
echo 3. Create a student + upload documents
echo.
echo Log files to check:
echo - Django console output (check for errors)
echo - Browser console (F12 → Console tab for upload logs)
echo.
pause
