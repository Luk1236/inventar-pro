@echo off
echo === Inventar Pro Windows Build ===
echo.
echo [1/3] Expo Web-Build erstellen...
cd ..\frontend
call npx expo export --platform web --output-dir ..\electron\web-dist
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: Expo-Build fehlgeschlagen
    exit /b 1
)
cd ..\electron
echo [2/3] Dependencies pruefen...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: npm install fehlgeschlagen
    exit /b 1
)
echo [3/3] Installer bauen...
call npx electron-builder --win --x64
if %ERRORLEVEL% NEQ 0 (
    echo FEHLER: electron-builder fehlgeschlagen
    exit /b 1
)
echo.
echo === Build abgeschlossen ===
echo Installer: electron\dist\InventarPro Setup 1.0.0.exe
pause
