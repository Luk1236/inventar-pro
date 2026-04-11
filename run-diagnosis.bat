@echo off
setlocal enabledelayedexpansion
echo ============================================
echo   Inventar Pro -- Vollstaendige Diagnose
echo ============================================
echo.

cd /d "%~dp0backend"

echo [1/3] pytest-html installieren (falls noetig)...
pip install pytest-html -q
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: pip install fehlgeschlagen
    exit /b 1
)

echo [2/3] Tests ausfuehren...
echo.
python -m pytest tests/ -v
set EXIT=%ERRORLEVEL%
echo.

echo [3/3] HTML-Report...
if exist diagnosis\report.html (
    echo Report: %~dp0backend\diagnosis\report.html
    start "" "%~dp0backend\diagnosis\report.html"
) else (
    echo Kein Report generiert.
)

echo.
echo ============================================
if %EXIT%==0 (
    echo   Ergebnis: ALLE TESTS BESTANDEN
) else (
    echo   Ergebnis: TESTS FEHLGESCHLAGEN -- Report pruefen
)
echo ============================================
exit /b %EXIT%
