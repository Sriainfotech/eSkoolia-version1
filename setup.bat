@echo off
REM eSkoolia Project Setup Script
REM This script sets up the eSkoolia project on Windows

echo.
echo ========================================
echo eSkoolia Project Setup
echo ========================================
echo.

REM STEP 1: Check versions
echo STEP 1: Checking Python, Node, and npm versions
echo ----------------------------------------
python --version
node --version
npm --version
echo.

REM STEP 2 & 3: Check and create venv if needed, and check/copy .env
cd backend
echo STEP 2: Checking for virtual environment and .env
echo ----------------------------------------

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
    echo Virtual environment created at: venv
) else (
    echo Virtual environment already exists
)

if not exist .env (
    echo Copying .env.example to .env...
    copy .env.example .env
    echo .env file created
) else (
    echo .env file already exists
)
echo.

REM STEP 4: Activate venv and install requirements
echo STEP 3: Activating virtual environment and installing requirements
echo ----------------------------------------
call venv\Scripts\activate.bat
echo Virtual environment activated
python --version
pip --version
echo Installing Python requirements from requirements.txt...
pip install -r requirements.txt
echo Python requirements installed
echo.

REM STEP 5: Install frontend npm dependencies
cd ..\frontend
echo STEP 4: Installing frontend npm dependencies
echo ----------------------------------------
echo Installing npm packages...
npm install
echo Frontend npm dependencies installed
echo.

REM Final summary
echo.
echo ========================================
echo STEP 5: Setup Complete
echo ========================================
echo Summary:
echo - Python version checked
echo - Node and npm versions checked
echo - Virtual environment created (if needed)
echo - .env file copied (if needed)
echo - Python requirements installed
echo - Frontend npm dependencies installed
echo.
echo Setup is complete! You can now run the development servers.
echo.

pause
