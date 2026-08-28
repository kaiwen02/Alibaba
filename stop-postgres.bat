@echo off
REM Stop the local PostgreSQL cluster for Pathfinder
"C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" -D "%~dp0postgres-data" stop
