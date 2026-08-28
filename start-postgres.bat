@echo off
REM Start the local PostgreSQL cluster for Pathfinder on port 5433
"C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" -D "%~dp0postgres-data" -l "%~dp0postgres-data\postgres.log" start -o "-p 5433"
if %errorlevel% neq 0 (
    echo Failed to start PostgreSQL. It may already be running.
) else (
    echo PostgreSQL started on port 5433.
)
