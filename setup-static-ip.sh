#!/bin/bash
# setup-static-ip.sh — Feste IP-Adresse für den Raspberry Pi einrichten
# Unterstützt: Raspberry Pi OS Bullseye/Buster (dhcpcd) und Bookworm (NetworkManager)
#
# Verwendung: sudo bash setup-static-ip.sh
#
# Nach dem Script: Pi neu starten damit die IP aktiv wird.

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
err()   { echo -e "${RED}[FEHLER]${NC} $1"; exit 1; }
title() { echo -e "\n${BOLD}${CYAN}$1${NC}"; }

# ─── Root-Check ───────────────────────────────────────────────────────────────
[ "$EUID" -ne 0 ] && err "Bitte als root ausführen: sudo bash setup-static-ip.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_ENV="$SCRIPT_DIR/backend/.env"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     Inventar Pro – Feste IP-Adresse einrichten               ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Aktives Interface ermitteln ──────────────────────────────────────────────
title "Netzwerk-Interface erkennen..."

IFACE=$(ip route show default 2>/dev/null | awk '/default/ {print $5}' | head -1)
if [ -z "$IFACE" ]; then
    # Fallback: erstes nicht-loopback Interface
    IFACE=$(ip -o link show | awk -F': ' '$2 != "lo" {print $2}' | head -1)
fi
[ -z "$IFACE" ] && err "Kein aktives Netzwerk-Interface gefunden."
info "Interface:  $IFACE"

# Aktuelle IP + Prefix
CURRENT_IP=$(ip -4 addr show "$IFACE" 2>/dev/null | awk '/inet / {print $2}' | head -1)
IP_ONLY=${CURRENT_IP%/*}
PREFIX=${CURRENT_IP#*/}
[ -z "$IP_ONLY" ] && err "Keine IPv4-Adresse auf $IFACE gefunden."
info "Aktuelle IP: $IP_ONLY/$PREFIX"

# Gateway
GW=$(ip route show default 2>/dev/null | awk '/default/ {print $3}' | head -1)
info "Gateway:     ${GW:-nicht gefunden}"

# DNS
DNS=$(grep "^nameserver" /etc/resolv.conf 2>/dev/null | awk '{print $2}' | head -2 | tr '\n' ',' | sed 's/,$//')
[ -z "$DNS" ] && DNS="${GW:-8.8.8.8}"
info "DNS:         $DNS"

# MAC-Adresse
MAC=$(cat /sys/class/net/"$IFACE"/address 2>/dev/null || ip link show "$IFACE" | awk '/ether/ {print $2}')
info "MAC-Adresse: $MAC"

# ─── Option B anzeigen: Router-Reservierung ───────────────────────────────────
echo ""
echo -e "${YELLOW}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${YELLOW}│  TIPP: Einfachste Methode – DHCP-Reservierung im Router     │${NC}"
echo -e "${YELLOW}│                                                              │${NC}"
echo -e "${YELLOW}│  MAC-Adresse des Pi: ${BOLD}$MAC${NC}${YELLOW}  │${NC}"
echo -e "${YELLOW}│                                                              │${NC}"
echo -e "${YELLOW}│  Im Router (FritzBox/Speedport etc.) diese MAC-Adresse      │${NC}"
echo -e "${YELLOW}│  einer festen IP zuweisen → kein Eingriff am Pi nötig.      │${NC}"
echo -e "${YELLOW}└─────────────────────────────────────────────────────────────┘${NC}"
echo ""
echo "Oder: Weiter mit diesem Script für statische IP direkt auf dem Pi."
echo ""

# ─── Gewünschte IP abfragen ───────────────────────────────────────────────────
read -p "Gewünschte feste IP-Adresse [${IP_ONLY}]: " DESIRED_IP
DESIRED_IP="${DESIRED_IP:-$IP_ONLY}"

# Einfache Validierung
if ! echo "$DESIRED_IP" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
    err "Ungültige IP-Adresse: $DESIRED_IP"
fi

read -p "Netzmaske (Prefix) [${PREFIX}]: " DESIRED_PREFIX
DESIRED_PREFIX="${DESIRED_PREFIX:-$PREFIX}"

read -p "Gateway [${GW}]: " DESIRED_GW
DESIRED_GW="${DESIRED_GW:-$GW}"

read -p "DNS [${DNS}]: " DESIRED_DNS
DESIRED_DNS="${DESIRED_DNS:-$DNS}"

echo ""
echo -e "${BOLD}Konfiguration:${NC}"
echo "  Interface:  $IFACE"
echo "  IP:         $DESIRED_IP/$DESIRED_PREFIX"
echo "  Gateway:    $DESIRED_GW"
echo "  DNS:        $DESIRED_DNS"
echo ""
read -p "Fortfahren? [J/n]: " CONFIRM
CONFIRM="${CONFIRM:-J}"
[[ "$CONFIRM" =~ ^[Nn] ]] && { echo "Abgebrochen."; exit 0; }

# ─── OS-Erkennung: dhcpcd vs NetworkManager ───────────────────────────────────
title "Netzwerk-System erkennen..."

if systemctl is-active --quiet NetworkManager 2>/dev/null && command -v nmcli &>/dev/null; then
    NM_MODE=true
    info "NetworkManager erkannt (Raspberry Pi OS Bookworm / Ubuntu)"
elif [ -f /etc/dhcpcd.conf ]; then
    NM_MODE=false
    info "dhcpcd erkannt (Raspberry Pi OS Bullseye / Buster)"
else
    err "Weder NetworkManager noch dhcpcd gefunden. Bitte IP manuell konfigurieren."
fi

# ─── Statische IP konfigurieren ───────────────────────────────────────────────
title "Statische IP konfigurieren..."

if [ "$NM_MODE" = false ]; then
    # ── dhcpcd ──
    DHCPCD_CONF="/etc/dhcpcd.conf"
    cp "$DHCPCD_CONF" "${DHCPCD_CONF}.bak.$(date +%Y%m%d_%H%M%S)"
    info "Backup: ${DHCPCD_CONF}.bak.*"

    # Alten static-Block für dieses Interface entfernen
    # Suche den Block "interface $IFACE" + folgende static-Zeilen
    python3 - "$DHCPCD_CONF" "$IFACE" <<'PYEOF'
import sys, re
conf_path, iface = sys.argv[1], sys.argv[2]
with open(conf_path) as f:
    content = f.read()
# Entferne Block: interface <iface> + alle direkt folgenden static/inform Zeilen
pattern = rf'\ninterface {re.escape(iface)}\n(?:(?:static|inform|nogateway)[^\n]*\n)*'
content = re.sub(pattern, '\n', content)
with open(conf_path, 'w') as f:
    f.write(content)
PYEOF

    # Neuen Block anhängen
    cat >> "$DHCPCD_CONF" << EOF

interface $IFACE
static ip_address=$DESIRED_IP/$DESIRED_PREFIX
static routers=$DESIRED_GW
static domain_name_servers=$(echo "$DESIRED_DNS" | tr ',' ' ')
EOF
    ok "dhcpcd.conf aktualisiert."

    # Dienst neu starten (Änderung greift nach Neustart sicher)
    systemctl restart dhcpcd 2>/dev/null && ok "dhcpcd neu gestartet." \
        || warn "dhcpcd konnte nicht neu gestartet werden — bitte Pi neu starten."

else
    # ── NetworkManager ──
    CON_NAME=$(nmcli -g NAME,DEVICE connection show --active 2>/dev/null \
        | grep ":$IFACE$" | cut -d: -f1 | head -1)
    [ -z "$CON_NAME" ] && CON_NAME="$IFACE"
    info "Verbindung: $CON_NAME"

    nmcli connection modify "$CON_NAME" \
        ipv4.method manual \
        ipv4.addresses "$DESIRED_IP/$DESIRED_PREFIX" \
        ipv4.gateway "$DESIRED_GW" \
        ipv4.dns "$(echo "$DESIRED_DNS" | tr ',' ' ')"

    nmcli connection down "$CON_NAME" 2>/dev/null || true
    nmcli connection up "$CON_NAME" 2>/dev/null \
        && ok "NetworkManager-Verbindung aktiviert." \
        || warn "Verbindung konnte nicht neu gestartet werden — bitte Pi neu starten."
fi

# ─── backend/.env aktualisieren ───────────────────────────────────────────────
title "CORS in backend/.env aktualisieren..."

if [ -f "$BACKEND_ENV" ]; then
    # Alte IP in ALLOWED_ORIGINS durch neue ersetzen
    if grep -q "$IP_ONLY" "$BACKEND_ENV"; then
        sed -i "s|$IP_ONLY|$DESIRED_IP|g" "$BACKEND_ENV"
        ok "IP $IP_ONLY → $DESIRED_IP in backend/.env ersetzt."
    else
        # Neue IP noch nicht enthalten → anhängen
        sed -i "s|^ALLOWED_ORIGINS=\(.*\)|ALLOWED_ORIGINS=\1,http://$DESIRED_IP:8002,http://$DESIRED_IP:8081|" "$BACKEND_ENV"
        ok "Neue IP zu ALLOWED_ORIGINS hinzugefügt."
    fi

    # Backend neu starten wenn aktiv
    for SVC in inventarpro-backend inventar-backend inventarpro; do
        if systemctl is-active --quiet "$SVC" 2>/dev/null; then
            systemctl restart "$SVC" && ok "Backend-Service '$SVC' neu gestartet."
            break
        fi
    done
else
    warn "backend/.env nicht gefunden — CORS manuell prüfen ($BACKEND_ENV)"
fi

# ─── Abschluss ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║  Fertig!                                                     ║${NC}"
echo -e "${BOLD}${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}${GREEN}║  Feste IP: ${DESIRED_IP}                                    "
echo -e "${BOLD}${GREEN}║  mDNS:     inventarpro.local (bleibt weiterhin aktiv)        ║${NC}"
echo -e "${BOLD}${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}${GREEN}║  Nächster Schritt:                                           ║${NC}"
echo -e "${BOLD}${GREEN}║    sudo reboot                                               ║${NC}"
echo -e "${BOLD}${GREEN}║                                                              ║${NC}"
echo -e "${BOLD}${GREEN}║  Nach dem Neustart in der App:                               ║${NC}"
echo -e "${BOLD}${GREEN}║    Einstellungen → Server-URL:                               ║${NC}"
echo -e "${BOLD}${GREEN}║    http://${DESIRED_IP}:8002                                 "
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
