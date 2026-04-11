# Cloudflare Tunnel — Anleitung für Raspberry Pi

## Voraussetzungen

- Raspberry Pi mit Inventar Pro Backend (Port 8002 läuft)
- Kostenloser Cloudflare-Account: https://cloudflare.com
- Internet-Verbindung auf dem Pi

## Einmalige Einrichtung

1. Script auf den Pi kopieren:
   ```bash
   scp setup-cloudflare-tunnel.sh pi@192.168.1.x:~/
   ```

2. Auf dem Pi ausführen:
   ```bash
   chmod +x setup-cloudflare-tunnel.sh
   sudo ./setup-cloudflare-tunnel.sh
   ```

3. Cloudflare-Login im Browser bestätigen

4. Nach dem Setup:
   ```bash
   sudo systemctl start cloudflared
   sudo systemctl enable cloudflared  # Autostart beim Booten
   ```

5. Deine URL herausfinden:
   ```bash
   cloudflared tunnel info inventarpro
   ```

## URL in der App eintragen

Settings → Server-URL → `https://<hash>.cfargotunnel.com` → Speichern

## Tunnel-Verwaltung

```bash
sudo systemctl status cloudflared     # Status
journalctl -u cloudflared -f          # Live-Logs
sudo systemctl restart cloudflared    # Neustart
```

## Kosten

Cloudflare Tunnel Free Tier: kostenlos, unbegrenzte Nutzung.
Kein Port-Forwarding am Router erforderlich.
