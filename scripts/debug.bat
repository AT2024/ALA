@echo off
REM ALA Debug Tool - Windows Wrapper
REM Calls the unified Node.js debug tool

echo Starting ALA Debug Tool...
node "%~dp0debug-unified.js" %*
