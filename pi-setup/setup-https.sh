#!/usr/bin/env bash
# Inventar Pro — HTTPS via Tailscale + nginx einrichten
# Voraussetzung: Tailscale ist installiert und verbunden
#                HTTPS muss im Tailscale-Admin aktiviert sein:
#                https://login.tailscale.com/admin/dns → HTTPS-Zertifikate aktivieren
# Aufruf: sudo bash setup-https.sh
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
info() { echo -e "${CYAN}  ▸${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }
die()  { echo -e "${RED}  ✗${NC} $1" >&2; exit 1; }

[[ $EUID -ne 0 ]] && die "Bitte als root ausführen: sudo bash setup-https.sh"

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${INSTALL_DIR}/backend/.env"

echo -e "\n${CYAN}━━ Inventar Pro — HTTPS Setup${NC}\n"

# ── Tailscale-Hostname ermitteln ──────────────────────────────
info "Tailscale-Hostname ermitteln..."
if ! command -v tailscale &>/dev/null; then
  die "Tailscale ist nicht installiert. Bitte zuerst installieren: curl -fsSL https://tailscale.com/install.sh | sh"
fi

TS_STATUS=$(tailscale status --json 2>/dev/null) || die "Tailscale ist nicht verbunden. Bitte zuerst: tailscale up"
TS_FQDN=$(echo "$TS_STATUS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Self']['DNSName'].rstrip('.'))" 2>/dev/null) \
  || die "Konnte Tailscale-Hostname nicht ermitteln. Ist MagicDNS aktiviert?"

[[ -z "$TS_FQDN" ]] && die "Tailscale-Hostname ist leer. Bitte MagicDNS im Tailscale-Admin aktivieren."
ok "Hostname: ${TS_FQDN}"

# ── TLS-Zertifikat holen ──────────────────────────────────────
CERT_DIR="/etc/ssl/tailscale"
info "TLS-Zertifikat für ${TS_FQDN} holen..."
mkdir -p "$CERT_DIR"
tailscale cert --cert-file "${CERT_DIR}/${TS_FQDN}.crt" \
               --key-file  "${CERT_DIR}/${TS_FQDN}.key" \
               "$TS_FQDN" \
  || die "Zertifikat konnte nicht abgerufen werden. Bitte HTTPS-Zertifikate im Tailscale-Admin aktivieren: https://login.tailscale.com/admin/dns"
chmod 640 "${CERT_DIR}/${TS_FQDN}.key"
ok "Zertifikat gespeichert in ${CERT_DIR}/"

# ── nginx installieren ────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
  info "nginx installieren..."
  apt-get install -y nginx -qq
  ok "nginx installiert"
fi

# ── nginx-Konfiguration schreiben ────────────────────────────
info "nginx-Konfiguration erstellen..."
NGINX_CONF="/etc/nginx/sites-available/inventar-pro"

cat > "$NGINX_CONF" <<NGINXEOF
# Inventar Pro — nginx HTTPS Reverse Proxy
# Generiert von setup-https.sh am $(date '+%Y-%m-%d')

# HTTP → HTTPS umleiten
server {
    listen 80;
    server_name ${TS_FQDN};
    return 301 https://\$host\$request_uri;
}

# App + API (HTTPS)
server {
    listen 443 ssl;
    server_name ${TS_FQDN};

    ssl_certificate     ${CERT_DIR}/${TS_FQDN}.crt;
    ssl_certificate_key ${CERT_DIR}/${TS_FQDN}.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Backend API + Frontend (alles auf Port 8002)
    location / {
        proxy_pass         http://127.0.0.1:8002;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 60s;
    }
}

# Dashboard (HTTPS, Port 8443)
server {
    listen 8443 ssl;
    server_name ${TS_FQDN};

    ssl_certificate     ${CERT_DIR}/${TS_FQDN}.crt;
    ssl_certificate_key ${CERT_DIR}/${TS_FQDN}.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
    }
}
NGINXEOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/inventar-pro
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t || die "nginx-Konfiguration ungültig"
systemctl enable nginx
systemctl restart nginx
ok "nginx gestartet"

# ── .env aktualisieren ────────────────────────────────────────
info ".env aktualisieren (ALLOWED_ORIGINS + BACKEND_URL)..."
if [[ -f "$ENV_FILE" ]]; then
  LOCAL_IP=$(hostname -I | awk '{print $1}')
  NEW_ORIGINS="http://localhost:8002,http://${LOCAL_IP}:8002,https://${TS_FQDN}"

  if grep -q "^ALLOWED_ORIGINS=" "$ENV_FILE"; then
    sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${NEW_ORIGINS}|" "$ENV_FILE"
  else
    echo "ALLOWED_ORIGINS=${NEW_ORIGINS}" >> "$ENV_FILE"
  fi
  ok ".env aktualisiert"
else
  warn ".env nicht gefunden — bitte ALLOWED_ORIGINS manuell setzen"
fi

# ── Zertifikat-Renewal via cron ──────────────────────────────
info "Automatische Zertifikatserneuerung einrichten..."
RENEW_SCRIPT="/usr/local/bin/tailscale-cert-renew.sh"
cat > "$RENEW_SCRIPT" <<'RENEWEOF'
#!/bin/bash
TS_FQDN=$(tailscale status --json | python3 -c "import sys,json; print(json.load(sys.stdin)['Self']['DNSName'].rstrip('.'))")
CERT_DIR="/etc/ssl/tailscale"
tailscale cert --cert-file "${CERT_DIR}/${TS_FQDN}.crt" \
               --key-file  "${CERT_DIR}/${TS_FQDN}.key" \
               "$TS_FQDN" && nginx -s reload
RENEWEOF
chmod +x "$RENEW_SCRIPT"

# Jeden Montag um 3:00 Uhr erneuern
CRON_LINE="0 3 * * 1 root ${RENEW_SCRIPT} >> /var/log/tailscale-cert-renew.log 2>&1"
if ! grep -q "tailscale-cert-renew" /etc/crontab 2>/dev/null; then
  echo "$CRON_LINE" >> /etc/crontab
  ok "Cron-Job für Zertifikatserneuerung eingerichtet"
else
  ok "Cron-Job bereits vorhanden"
fi

# ── Backend neu starten ───────────────────────────────────────
info "Backend neu starten..."
systemctl restart inventar-backend
ok "Backend neugestartet"

# ── Zusammenfassung ───────────────────────────────────────────
echo ""
echo -e "${GREEN}━━ HTTPS erfolgreich eingerichtet! ━━${NC}"
echo ""
echo -e "  App:       ${CYAN}https://${TS_FQDN}${NC}"
echo -e "  Dashboard: ${CYAN}https://${TS_FQDN}:8443${NC}"
echo ""
echo -e "${YELLOW}  Nächster Schritt:${NC}"
echo -e "  In der Inventar Pro App unter Einstellungen die Server-URL auf"
echo -e "  ${CYAN}https://${TS_FQDN}${NC} setzen."
echo ""
