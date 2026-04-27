#!/bin/bash
# ============================================================
# Inventar Pro - Version Control & Deployment System
# Erstellt: 2024
# ============================================================

set -e  # Stop bei Fehlern

# ===========================================
# KONFIGURATION
# ===========================================
PROJECT_NAME="inventar-pro"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSIONS_DIR="$PROJECT_DIR/versions"
ARCHIVE_DIR="$PROJECT_DIR/archive"
LOG_FILE="$PROJECT_DIR/logs/version-control.log"
CURRENT_LINK="$PROJECT_DIR/current"

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ===========================================
# HILFSFUNKTIONEN
# ===========================================

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] $1" | tee -a "$LOG_FILE"
}

info() {
    log "${BLUE}[INFO]${NC} $1"
}

success() {
    log "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    log "${YELLOW}[WARN]${NC} $1"
}

error() {
    log "${RED}[ERROR]${NC} $1"
}

# ===========================================
# INITIALISIERUNG
# ===========================================

init() {
    info "Initialisiere Versionskontrollsystem..."

    # Verzeichnisse erstellen
    mkdir -p "$VERSIONS_DIR"
    mkdir -p "$ARCHIVE_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"

    # Initiales Backup falls noch keine Version existiert
    if [ ! -d "$VERSIONS_DIR/v1" ]; then
        info "Erstelle initiale Version v1..."
        save_version "1" "Initial version"
    fi

    # Symlink für 'current' erstellen falls nicht vorhanden
    if [ ! -L "$CURRENT_LINK" ] && [ -d "$VERSIONS_DIR/v1" ]; then
        ln -sfn "$VERSIONS_DIR/v1" "$CURRENT_LINK"
        success "Symlink 'current' erstellt"
    fi

    success "Initialisierung abgeschlossen"
}

# ===========================================
# VERSION SPEICHERN
# ===========================================

get_next_version() {
    local latest=$(ls -1 "$VERSIONS_DIR" 2>/dev/null | grep -E '^v[0-9]+$' | sort -V | tail -1 | sed 's/v//')
    if [ -z "$latest" ]; then
        echo "1"
    else
        echo $((latest + 1))
    fi
}

get_current_version() {
    if [ -L "$CURRENT_LINK" ]; then
        basename "$(readlink "$CURRENT_LINK")" | sed 's/v//'
    else
        echo "0"
    fi
}

save_version() {
    local version="${1:-$(get_next_version)}"
    local message="${2:-Manual save}"
    local version_dir="$VERSIONS_DIR/v$version"
    local timestamp=$(date '+%Y%m%d_%H%M%S')

    info "Speichere Version v$version..."

    # Verzeichnis erstellen
    mkdir -p "$version_dir"

    # Backend speichern
    if [ -d "$PROJECT_DIR/backend" ]; then
        mkdir -p "$version_dir/backend"
        cp -r "$PROJECT_DIR/backend/"*.py "$version_dir/backend/" 2>/dev/null || true
        cp -r "$PROJECT_DIR/backend/app" "$version_dir/backend/" 2>/dev/null || true
        cp "$PROJECT_DIR/backend/requirements.txt" "$version_dir/backend/" 2>/dev/null || true
        cp "$PROJECT_DIR/backend/.env.example" "$version_dir/backend/" 2>/dev/null || true
    fi

    # Frontend speichern (nur wichtige Dateien)
    if [ -d "$PROJECT_DIR/frontend/app" ]; then
        mkdir -p "$version_dir/frontend"
        cp -r "$PROJECT_DIR/frontend/app" "$version_dir/frontend/" 2>/dev/null || true
        cp -r "$PROJECT_DIR/frontend/services" "$version_dir/frontend/" 2>/dev/null || true
        cp -r "$PROJECT_DIR/frontend/hooks" "$version_dir/frontend/" 2>/dev/null || true
        cp -r "$PROJECT_DIR/frontend/components" "$version_dir/frontend/" 2>/dev/null || true
        cp -r "$PROJECT_DIR/frontend/contexts" "$version_dir/frontend/" 2>/dev/null || true
        cp -r "$PROJECT_DIR/frontend/utils" "$version_dir/frontend/" 2>/dev/null || true
        cp "$PROJECT_DIR/frontend/package.json" "$version_dir/frontend/" 2>/dev/null || true
        cp "$PROJECT_DIR/frontend/app.json" "$version_dir/frontend/" 2>/dev/null || true
        cp "$PROJECT_DIR/frontend/app.config.js" "$version_dir/frontend/" 2>/dev/null || true
    fi

    # Metadaten
    cat > "$version_dir/metadata.json" << EOF
{
    "version": "$version",
    "timestamp": "$(date -Iseconds)",
    "message": "$message",
    "git_commit": "$(cd "$PROJECT_DIR" && git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(cd "$PROJECT_DIR" && git branch --show-current 2>/dev/null || echo 'unknown')"
}
EOF

    # Dokumentation
    cat > "$version_dir/VERSION.md" << EOF
# Inventar Pro - Version $version

**Erstellt:** $(date '+%Y-%m-%d %H:%M:%S')
**Beschreibung:** $message

## Änderungen
- Version gespeichert

## Dateien
- Backend: $(find "$version_dir/backend" -type f 2>/dev/null | wc -l) Dateien
- Frontend: $(find "$version_dir/frontend" -type f 2>/dev/null | wc -l) Dateien
EOF

    success "Version v$version gespeichert in $version_dir"
    echo "$version"
}

# ===========================================
# UPDATE DURCHFÜHREN
# ===========================================

update() {
    local new_version=$(get_next_version)
    local current_version=$(get_current_version)
    local message="${1:-Update to version $new_version}"
    local timestamp=$(date '+%Y%m%d_%H%M%S')

    info "Starte Update-Prozess..."

    # 1. Aktuelle Version archivieren
    if [ "$current_version" != "0" ] && [ -d "$VERSIONS_DIR/v$current_version" ]; then
        local archive_name="v${current_version}_${timestamp}"
        info "Archiviere aktuelle Version v$current_version..."
        mkdir -p "$ARCHIVE_DIR"
        cp -r "$VERSIONS_DIR/v$current_version" "$ARCHIVE_DIR/$archive_name"
        success "Archiv erstellt: $ARCHIVE_DIR/$archive_name"
    fi

    # 2. Neue Version speichern
    save_version "$new_version" "$message"

    # 3. Symlink aktualisieren
    ln -sfn "$VERSIONS_DIR/v$new_version" "$CURRENT_LINK"
    success "Symlink 'current' auf v$new_version aktualisiert"

    # 4. Log-Eintrag
    cat >> "$PROJECT_DIR/logs/updates.log" << EOF
[$(date '+%Y-%m-%d %H:%M:%S')] UPDATE: v$current_version -> v$new_version
    Message: $message
    Archive: $ARCHIVE_DIR/v${current_version}_${timestamp}
    Status: SUCCESS
EOF

    # 5. Cleanup - nur letzte 5 Archive behalten
    cleanup_old_archives

    success "Update auf v$new_version abgeschlossen!"
}

# ===========================================
# ROLLBACK
# ===========================================

rollback() {
    local target_version="${1:-}"
    local current_version=$(get_current_version)

    if [ -z "$target_version" ]; then
        # Letztes Archive verwenden
        local last_archive=$(ls -1t "$ARCHIVE_DIR" 2>/dev/null | head -1)
        if [ -z "$last_archive" ]; then
            error "Kein Archive für Rollback gefunden!"
            exit 1
        fi
        target_version=$(echo "$last_archive" | sed 's/v\([0-9]*\)_.*/\1/')
        target_version_dir="$ARCHIVE_DIR/$last_archive"
        info "Verwende letztes verfügbares Archive: $last_archive"
    else
        # Spezifische Version
        if [ -d "$VERSIONS_DIR/v$target_version" ]; then
            target_version_dir="$VERSIONS_DIR/v$target_version"
        elif [ -d "$ARCHIVE_DIR/v$target_version"* ]; then
            target_version_dir=$(ls -1t "$ARCHIVE_DIR/v$target_version"* 2>/dev/null | head -1)
        else
            error "Version v$target_version nicht gefunden!"
            list_versions
            exit 1
        fi
    fi

    # Rollback durchführen
    info "Führe Rollback durch: v$current_version -> v$target_version"

    # Backup der aktuellen (kaputten) Version
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    if [ -L "$CURRENT_LINK" ] && [ -d "$(readlink "$CURRENT_LINK")" ]; then
        local broken_dir="$(readlink "$CURRENT_LINK")"
        cp -r "$broken_dir" "$ARCHIVE_DIR/broken_v${current_version}_${timestamp}" 2>/dev/null || true
        warn "Kaputte Version archiviert: broken_v${current_version}_${timestamp}"
    fi

    # Ziel-Version wiederherstellen
    ln -sfn "$target_version_dir" "$CURRENT_LINK"

    # Log-Eintrag
    cat >> "$PROJECT_DIR/logs/updates.log" << EOF
[$(date '+%Y-%m-%d %H:%M:%S')] ROLLBACK: v$current_version -> v$target_version
    Source: $target_version_dir
    Status: SUCCESS
EOF

    success "Rollback auf v$target_version erfolgreich!"
    info "Bitte Backend neu starten: cd backend && python server.py"
}

# ===========================================
# AUFLISTEN
# ===========================================

list_versions() {
    echo ""
    echo "======================================"
    echo "  Verfügbare Versionen"
    echo "======================================"
    echo ""

    info "Gespeicherte Versionen:"
    for v in $(ls -1 "$VERSIONS_DIR" 2>/dev/null | grep -E '^v[0-9]+$' | sort -V); do
        local metadata="$VERSIONS_DIR/$v/metadata.json"
        if [ -f "$metadata" ]; then
            local msg=$(grep -o '"message": "[^"]*"' "$metadata" | cut -d'"' -f4)
            local ts=$(grep -o '"timestamp": "[^"]*"' "$metadata" | cut -d'"' -f4)
            echo "  📦 $v - $ts"
            echo "      $msg"
        else
            echo "  📦 $v"
        fi
    done

    echo ""
    info "Archive:"
    for a in $(ls -1t "$ARCHIVE_DIR" 2>/dev/null | head -10); do
        echo "  🗄️  $a"
    done

    echo ""
    local current=$(get_current_version)
    if [ "$current" != "0" ]; then
        success "Aktuelle Version: v$current"
    else
        warn "Keine aktive Version gesetzt"
    fi
    echo ""
}

# ===========================================
# CLEANUP
# ===========================================

cleanup_old_archives() {
    local keep_count=5
    local count=$(ls -1 "$ARCHIVE_DIR" 2>/dev/null | wc -l)

    if [ "$count" -gt "$keep_count" ]; then
        info "Bereinige alte Archive (behalte $keep_count)..."
        ls -1t "$ARCHIVE_DIR" | tail -n +$((keep_count + 1)) | while read old; do
            rm -rf "$ARCHIVE_DIR/$old"
            warn "Entfernt: $old"
        done
    fi
}

# ===========================================
# DEPLOY (für Production)
# ===========================================

deploy() {
    local target="${1:-production}"
    local current_version=$(get_current_version)

    info "Deploy zu $target..."

    # Services stoppen
    warn "Stoppe Services..."
    pkill -f "python server.py" 2>/dev/null || true
    # pkill -f "expo start" 2>/dev/null || true  # Frontend nur im Dev-Modus

    sleep 2

    # Neue Version aktivieren
    if [ -L "$CURRENT_LINK" ]; then
        ln -sfn "$(readlink "$CURRENT_LINK")" "$PROJECT_DIR/active"
    fi

    # Backend neu starten
    if [ -d "$PROJECT_DIR/backend" ]; then
        info "Starte Backend..."
        cd "$PROJECT_DIR/backend"
        nohup python server.py > "$PROJECT_DIR/logs/backend.log" 2>&1 &
    fi

    # Log
    cat >> "$PROJECT_DIR/logs/updates.log" << EOF
[$(date '+%Y-%m-%d %H:%M:%S')] DEPLOY: v$current_version to $target
    Status: SUCCESS
EOF

    success "Deploy abgeschlossen!"
}

# ===========================================
# STATUS
# ===========================================

status() {
    echo ""
    echo "======================================"
    echo "  Inventar Pro - System Status"
    echo "======================================"
    echo ""

    # Backend Status
    if pgrep -f "python server.py" > /dev/null; then
        success "Backend: LÄUFT"
    else
        error "Backend: GESTOPPT"
    fi

    # MongoDB Status
    if pgrep -f "mongod" > /dev/null; then
        success "MongoDB: LÄUFT"
    else
        warn "MongoDB: NICHT GEFUNDEN"
    fi

    # Frontend Status (nur im Dev-Modus relevant)
    if pgrep -f "expo" > /dev/null; then
        success "Frontend: LÄUFT"
    else
        info "Frontend: GESTOPPT (normal für Production)"
    fi

    echo ""

    # Version Info
    local current=$(get_current_version)
    local next=$(get_next_version)
    echo "Aktuelle Version: v$current"
    echo "Nächste Version: v$next"
    echo "Versionen gespeichert: $(ls -1 "$VERSIONS_DIR" 2>/dev/null | grep -E '^v[0-9]+$' | wc -l)"
    echo "Archive vorhanden: $(ls -1 "$ARCHIVE_DIR" 2>/dev/null | wc -l)"
    echo ""

    # Disk Usage
    echo "Speicherverbrauch:"
    du -sh "$VERSIONS_DIR" 2>/dev/null || echo "  Versions: N/A"
    du -sh "$ARCHIVE_DIR" 2>/dev/null || echo "  Archive: N/A"
    echo ""
}

# ===========================================
# MAIN
# ===========================================

case "${1:-help}" in
    init)
        init
        ;;
    save)
        save_version "$2" "$3"
        ;;
    update)
        update "$2"
        ;;
    rollback)
        rollback "$2"
        ;;
    list|versions)
        list_versions
        ;;
    deploy)
        deploy "$2"
        ;;
    status)
        status
        ;;
    cleanup)
        cleanup_old_archives
        success "Cleanup abgeschlossen"
        ;;
    help|--help|-h)
        echo ""
        echo "Inventar Pro - Versionskontrollsystem"
        echo "======================================"
        echo ""
        echo "Befehle:"
        echo "  init          System initialisieren"
        echo "  save [v] [msg]  Version speichern (auto-Increment wenn v fehlt)"
        echo "  update [msg]  Neue Version erstellen + aktivieren"
        echo "  rollback [v]  Zurück zur Version v (oder letztem Archive)"
        echo "  list          Alle Versionen anzeigen"
        echo "  deploy [env]  Deploy durchführen (production/staging)"
        echo "  status        System-Status anzeigen"
        echo "  cleanup       Alte Archive entfernen"
        echo ""
        echo "Beispiele:"
        echo "  ./version-control.sh update 'Bugfix: Login repariert'"
        echo "  ./version-control.sh rollback 5"
        echo "  ./version-control.sh list"
        echo ""
        ;;
    *)
        error "Unbekannter Befehl: $1"
        echo "Führe './version-control.sh help' aus für Hilfe."
        exit 1
        ;;
esac