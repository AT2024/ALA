@echo off
echo Setting up Accountability Log Application...

echo Creating necessary directories...
mkdir logs 2>nul

echo Installing backend dependencies...
cd backend
npm install
cd ..

echo Installing frontend dependencies...
cd frontend
npm install
cd ..

echo Setting up version control...
git init
git add .
git commit -m "Initial commit: ALA setup"
git branch -M main
git branch ui-development
git branch backend-development
git branch integration

echo Setup completed successfully!
echo.
echo To start development:
echo - Backend: cd backend && npm run dev
echo - Frontend: cd frontend && npm run dev

pause
