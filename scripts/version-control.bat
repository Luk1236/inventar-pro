@echo off
REM ============================================================
REM Inventar Pro - Version Control & Deployment System (Windows)
REM Erstellt: 2024
REM ============================================================

setlocal enabledelayedexpansion

REM Konfiguration
set PROJECT_DIR=%~dp0..
set VERSIONS_DIR=%PROJECT_DIR%\versions
set ARCHIVE_DIR=%PROJECT_DIR%\archive
set LOG_FILE=%PROJECT_DIR%\logs\version-control.log
set CURRENT_LINK=%PROJECT_DIR%\current

REM Farben aktivieren (Windows 10+)
for /f %%i in ('echo prompt $E^| cmd') do set "ESC=%%i"

REM ===========================================
REM MAIN
REM ===========================================

if "%1"=="" goto help
if "%1"=="init" goto init
if "%1"=="save" goto save
if "%1"=="update" goto update
if "%1"=="rollback" goto rollback
if "%1"=="list" goto list
if "%1"=="versions" goto list
if "%1"=="status" goto status
if "%1"=="deploy" goto deploy
if "%1"=="cleanup" goto cleanup
if "%1"=="help" goto help
if "%1"=="--help" goto help
if "%1"=="-h" goto help

echo Unbekannter Befehl: %1
goto help

REM ===========================================
REM INITIALISIERUNG
REM ===========================================

:init
echo Initialisiere Versionskontrollsystem...

REM Verzeichnisse erstellen
if not exist "%VERSIONS_DIR%" mkdir "%VERSIONS_DIR%"
if not exist "%ARCHIVE_DIR%" mkdir "%ARCHIVE_DIR%"
if not exist "%PROJECT_DIR%\logs" mkdir "%PROJECT_DIR%\logs"

REM Log-Datei initialisieren
echo [%date% %time%] INIT: Versionskontrollsystem initialisiert >> "%LOG_FILE%"

REM Initiales Backup falls noch keine Version existiert
if not exist "%VERSIONS_DIR%\v1" (
    echo Erstelle initiale Version v1...
    call :save_version_impl "1" "Initial version"
)

echo.
echo [SUCCESS] Initialisierung abgeschlossen
goto end

REM ===========================================
REM VERSION SPEICHERN
REM ===========================================

:save
set VERSION=%2
set MSG=%3
if "%VERSION%"=="" (
    call :get_next_version
    set VERSION=!NEXT_VERSION!
)
if "%MSG%"=="" set MSG=Manual save

call :save_version_impl "%VERSION%" "%MSG%"
goto end

:save_version_impl
set SV_VERSION=%~1
set SV_MSG=%~2
set SV_DIR=%VERSIONS_DIR%\v%SV_VERSION%
set TS=%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TS=%TS: =0%

echo Speichere Version v%SV_VERSION%...

REM Verzeichnis erstellen
if not exist "%SV_DIR%" mkdir "%SV_DIR%"

REM Backend speichern
if exist "%PROJECT_DIR%\backend" (
    if not exist "%SV_DIR%\backend" mkdir "%SV_DIR%\backend"
    xcopy "%PROJECT_DIR%\backend\*.py" "%SV_DIR%\backend\" /Y /Q >nul 2>&1
    xcopy "%PROJECT_DIR%\backend\app" "%SV_DIR%\backend\app\" /E /Y /Q >nul 2>&1
    copy "%PROJECT_DIR%\backend\requirements.txt" "%SV_DIR%\backend\" /Y >nul 2>&1
    copy "%PROJECT_DIR%\backend\.env.example" "%SV_DIR%\backend\" /Y >nul 2>&1
)

REM Frontend speichern
if exist "%PROJECT_DIR%\frontend\app" (
    if not exist "%SV_DIR%\frontend" mkdir "%SV_DIR%\frontend"
    xcopy "%PROJECT_DIR%\frontend\app" "%SV_DIR%\frontend\app\" /E /Y /Q >nul 2>&1
    xcopy "%PROJECT_DIR%\frontend\services" "%SV_DIR%\frontend\services\" /E /Y /Q >nul 2>&1
    xcopy "%PROJECT_DIR%\frontend\hooks" "%SV_DIR%\frontend\hooks\" /E /Y /Q >nul 2>&1
    xcopy "%PROJECT_DIR%\frontend\components" "%SV_DIR%\frontend\components\" /E /Y /Q >nul 2>&1
    copy "%PROJECT_DIR%\frontend\package.json" "%SV_DIR%\frontend\" /Y >nul 2>&1
    copy "%PROJECT_DIR%\frontend\app.json" "%SV_DIR%\frontend\" /Y >nul 2>&1
)

REM Metadaten
(
echo {
echo     "version": "%SV_VERSION%",
echo     "timestamp": "%date% %time%",
echo     "message": "%SV_MSG%",
echo     "git_commit": "unknown"
echo }
) > "%SV_DIR%\metadata.json"

REM Dokumentation
(
echo # Inventar Pro - Version %SV_VERSION%
echo.
echo **Erstellt:** %date% %time%
echo **Beschreibung:** %SV_MSG%
) > "%SV_DIR%\VERSION.md"

echo [%date% %time%] SAVE: Version v%SV_VERSION% gespeichert >> "%LOG_FILE%"
echo [SUCCESS] Version v%SV_VERSION% gespeichert
goto :eof

REM ===========================================
REM UPDATE
REM ===========================================

:update
set MSG=%2
if "%MSG%"=="" set MSG=Update

call :get_next_version
set NEW_VER=!NEXT_VERSION!
call :get_current_version
set CUR_VER=!CURRENT_VER!

echo Starte Update-Prozess...
echo Aktuelle Version: v%CUR_VER%
echo Neue Version: v%NEW_VER%

REM 1. Aktuelle Version archivieren
if not "%CUR_VER%"=="0" (
    if exist "%VERSIONS_DIR%\v%CUR_VER%" (
        set TS=%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
        set TS=!TS: =0!
        echo Archiviere v%CUR_VER%...
        xcopy "%VERSIONS_DIR%\v%CUR_VER%" "%ARCHIVE_DIR%\v%CUR_VER%_!TS!\" /E /Y /Q >nul 2>&1
        echo [SUCCESS] Archiv erstellt
    )
)

REM 2. Neue Version speichern
call :save_version_impl "%NEW_VER%" "%MSG%"

REM 3. Current-Link aktualisieren
if exist "%CURRENT_LINK%" rmdir /Q "%CURRENT_LINK%" 2>nul
mklink /J "%CURRENT_LINK%" "%VERSIONS_DIR%\v%NEW_VER%" >nul

REM 4. Log
echo [%date% %time%] UPDATE: v%CUR_VER% -^> v%NEW_VER% - %MSG% >> "%PROJECT_DIR%\logs\updates.log"

echo [SUCCESS] Update auf v%NEW_VER% abgeschlossen!
goto end

REM ===========================================
REM ROLLBACK
REM ===========================================

:rollback
set TARGET=%2

if "%TARGET%"=="" (
    REM Letztes Archive verwenden
    for /f "delims=" %%a in ('dir /b /o-d "%ARCHIVE_DIR%" 2^>nul') do (
        set LAST_ARCHIVE=%%a
        goto :found_archive
    )
    echo [ERROR] Kein Archive fuer Rollback gefunden!
    goto end
)

:found_archive
if "%TARGET%"=="" (
    if defined LAST_ARCHIVE (
        echo Verwende letztes Archive: %LAST_ARCHIVE%
        set TARGET_DIR=%ARCHIVE_DIR%\%LAST_ARCHIVE%
    )
) else (
    if exist "%VERSIONS_DIR%\v%TARGET%" (
        set TARGET_DIR=%VERSIONS_DIR%\v%TARGET%
    ) else (
        echo [ERROR] Version v%TARGET% nicht gefunden!
        goto list
    )
)

echo Führe Rollback durch...

REM Current-Backup
call :get_current_version
set CUR_VER=!CURRENT_VER!
set TS=%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TS=%TS: =0%

if exist "%CURRENT_LINK%" (
    set CUR_DIR=current
    xcopy "%CURRENT_LINK%" "%ARCHIVE_DIR%\broken_v%CUR_VER%_%TS%\" /E /Y /Q >nul 2>&1
    echo [WARN] Kaputte Version archiviert: broken_v%CUR_VER%_%TS%
)

REM Ziel-Version wiederherstellen
if exist "%CURRENT_LINK%" rmdir /Q "%CURRENT_LINK%" 2>nul
mklink /J "%CURRENT_LINK%" "%TARGET_DIR%" >nul

echo [%date% %time%] ROLLBACK: v%CUR_VER% -^> v%TARGET% >> "%PROJECT_DIR%\logs\updates.log"
echo [SUCCESS] Rollback erfolgreich!
echo Bitte Backend neu starten: cd backend ^&^& python server.py
goto end

REM ===========================================
REM LIST
REM ===========================================

:list
echo.
echo ======================================
echo   Verfügbare Versionen
echo ======================================
echo.

echo Gespeicherte Versionen:
for /d %%v in ("%VERSIONS_DIR%\v*") do (
    set VNAME=%%~nxv
    if exist "%%v\metadata.json" (
        echo   [32m[OK][0m !VNAME!
    ) else (
        echo   [33m[??][0m !VNAME!
    )
)

echo.
echo Archive:
for /d %%a in ("%ARCHIVE_DIR%\v*") do (
    set ANAME=%%~nxa
    echo   [34m[ARCHIVE][0m !ANAME!
)

echo.
call :get_current_version
echo Aktuelle Version: v!CURRENT_VER!
echo.
goto end

REM ===========================================
REM STATUS
REM ===========================================

:status
echo.
echo ======================================
echo   Inventar Pro - System Status
echo ======================================
echo.

REM Backend Status
tasklist /FI "IMAGENAME eq python.exe" /FI "WINDOWTITLE eq *server*" 2>nul | find "python" >nul
if %errorlevel%==0 (
    echo [32mBackend: LÄUFT[0m
) else (
    REM Alternative Prüfung
    netstat -an | find "8002" | find "LISTENING" >nul
    if %errorlevel%==0 (
        echo [32mBackend: LÄUFT (Port 8002)[0m
    ) else (
        echo [31mBackend: GESTOPPT[0m
    )
)

REM MongoDB Status
tasklist /FI "IMAGENAME eq mongod.exe" 2>nul | find "mongod" >nul
if %errorlevel%==0 (
    echo [32mMongoDB: LÄUFT[0m
) else (
    netstat -an | find "27017" | find "LISTENING" >nul
    if %errorlevel%==0 (
        echo [32mMongoDB: LÄUFT (Port 27017)[0m
    ) else (
        echo [33mMongoDB: GESTOPPT[0m
    )
)

echo.

call :get_current_version
call :get_next_version
echo Aktuelle Version: v!CURRENT_VER!
echo Nächste Version: v!NEXT_VERSION!

echo.
dir /s "%VERSIONS_DIR%" 2>nul | find "Datei(en)" >nul
echo.
goto end

REM ===========================================
REM DEPLOY
REM ===========================================

:deploy
echo Deploy wird ausgeführt...

REM Services stoppen
taskkill /F /FI "IMAGENAME eq python.exe" /FI "WINDOWTITLE eq *server*" 2>nul
timeout /t 2 >nul

REM Backend neu starten
cd /d "%PROJECT_DIR%\backend"
start "InventarPro-Backend" python server.py

echo [%date% %time%] DEPLOY: Erfolgreich >> "%PROJECT_DIR%\logs\updates.log"
echo [SUCCESS] Deploy abgeschlossen!
goto end

REM ===========================================
REM CLEANUP
REM ===========================================

:cleanup
echo Bereinige alte Archive (behalte 5)...

set COUNT=0
for /f "delims=" %%a in ('dir /b /o-d "%ARCHIVE_DIR%" 2^>nul') do (
    set /a COUNT+=1
    if !COUNT! gtr 5 (
        rmdir /s /q "%ARCHIVE_DIR%\%%a" 2>nul
        echo Entfernt: %%a
    )
)

echo [SUCCESS] Cleanup abgeschlossen
goto end

REM ===========================================
REM HILFSFUNKTIONEN
REM ===========================================

:get_next_version
set NEXT_VERSION=1
for /d %%v in ("%VERSIONS_DIR%\v*") do (
    set VNUM=%%~nxv
    set VNUM=!VNUM:~1!
    if !VNUM! gtr !NEXT_VERSION! set NEXT_VERSION=!VNUM!
)
set /a NEXT_VERSION+=1
goto :eof

:get_current_version
set CURRENT_VER=0
if exist "%CURRENT_LINK%" (
    for /f "delims=" %%a in ('dir "%CURRENT_LINK%" ^| find "<JUNCTION>"') do (
        set CUR_DIR=%%a
    )
    REM Extrahiere Version aus Junction-Target
    if exist "%CURRENT_LINK%\metadata.json" (
        for /f "tokens=2 delims=:," %%v in ('type "%CURRENT_LINK%\metadata.json" ^| find "version"') do (
            set CURRENT_VER=%%v
            set CURRENT_VER=!CURRENT_VER:"=!
            set CURRENT_VER=!CURRENT_VER: =!
        )
    )
)
goto :eof

REM ===========================================
REM HELP
REM ===========================================

:help
echo.
echo Inventar Pro - Versionskontrollsystem (Windows)
echo ======================================
echo.
echo Befehle:
echo   init          System initialisieren
echo   save [v] [msg]  Version speichern
echo   update [msg]  Neue Version erstellen + aktivieren
echo   rollback [v]  Zurück zur Version v
echo   list          Alle Versionen anzeigen
echo   status        System-Status anzeigen
echo   deploy        Deploy durchführen
echo   cleanup       Alte Archive entfernen
echo.
echo Beispiele:
echo   version-control.bat update "Bugfix: Login repariert"
echo   version-control.bat rollback 5
echo   version-control.bat list
echo.
goto end

:end
endlocal