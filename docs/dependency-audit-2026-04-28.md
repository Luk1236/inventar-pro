# Dependency Audit — 2026-04-28

Snapshot von `pip list --outdated` und `npm outdated` zur Orientierung.
Es wurden **keine Updates angewendet** — Major-Bumps brauchen Migration-Tests.

## Backend (Python, 64 outdated)

### Sicherheits-/Auth-Pakete (höchste Priorität, einzeln testen)
- `bcrypt` 4.3.0 → 5.0.0  *(major; jetzt schon Warning beim Start, siehe Login-Reset)*
- `cryptography` 45.0.6 → 47.0.0  *(major)*
- `PyJWT` 2.10.1 → 2.12.1  *(minor, sicher)*

### Web-Framework-Stack (zusammen migrieren!)
- `fastapi` 0.110.1 → 0.136.1  *(viele minors, enthält OpenAPI/Pydantic-v2-Verbesserungen)*
- `starlette` 0.37.2 → 1.0.0  *(major — Breaking Changes prüfen)*
- `uvicorn` 0.25.0 → 0.46.0  *(viele minors)*
- `pydantic` 2.11.7 → 2.13.3  *(safe minor)*
- `pydantic_core` 2.33.2 → 2.46.3
- `pydantic-settings` 2.9.1 → 2.14.0
- `python-multipart` 0.0.20 → 0.0.27

### DB / Async
- `pymongo` 4.5.0 → 4.17.0  *(viele minors, sicherheitsrelevant)*
- `anyio` 4.10.0 → 4.13.0
- `aiosmtplib` 4.0.2 → 5.1.0  *(major)*

### Test / Tooling
- `pytest` 8.4.1 → 9.0.3  *(major)*
- `pytest-asyncio` 0.23.8 → 1.3.0  *(major)*
- `pytest-cov` 5.0.0 → 7.1.0  *(major)*
- `black` 25.1.0 → 26.3.1
- `isort` 6.0.1 → 8.0.1  *(major)*

### Konnte komplett raus aus requirements.txt (wurden aber nicht entfernt vom System)
*Schon bereinigt in Commit `974c985`:* boto3, botocore, jq, s3transfer, s5cmd

### Niedrige Priorität (Bibliotheks-Minor-Bumps, alle safe)
APScheduler, certifi, charset-normalizer, click, dnspython, ecdsa,
filelock, httpx, idna, iniconfig, jmespath, matplotlib,
polars-runtime-32, pyasn1, pycparser, Pygments, python-dotenv, pytz,
reportlab, requests, rich, setuptools, typer, typing-inspection,
tzdata, ultralytics, urllib3, watchfiles  …

## Frontend (Node, 49 outdated)

### Massive Major-Sprünge: das ganze Expo-Ökosystem hängt mehrere Generationen zurück
- `expo` 54.0.33 → **55.0.18**  *(Major-Bump → SDK-Migration nötig)*
- alle `expo-*` (blur, camera, constants, device, file-system, font,
  haptics, image, image-picker, linking, notifications, print,
  router, secure-store, sharing, splash-screen, status-bar) sind
  von ~15.x → 55.x  *(Versionierung wurde an die SDK-Version angeglichen)*
- → **Eine SDK-Migration als ein Vorgang**, nicht einzeln. Expo veröffentlicht
  einen Migration-Guide pro Major.

### Andere Majors
- `@react-native-async-storage/async-storage` 2.2.0 → 3.0.2
- `@react-native-community/netinfo` 11.4.1 → 12.0.1
- `eslint` 9 → 10  *(major, neue Flat-Config bricht Plugins)*
- `eslint-config-expo` 10 → 55  *(an SDK gekoppelt)*
- `@types/jest` 29 → 30

### Niedrige Priorität (sichere Minor-Bumps)
@babel/core, @react-native-picker/picker, @react-navigation/*,
@testing-library/react-native, @types/react

## Empfehlung: Reihenfolge der Updates

### Phase 1 — Backend Sicherheit (1 Sprint, einzelne Commits + pytest dazwischen)
1. `bcrypt` 4 → 5 *(Login + Password-Hash testen)*
2. `cryptography` 45 → 47
3. `PyJWT` minor
4. `pymongo` minor-Sequenz

### Phase 2 — Backend Web-Stack (zusammen, ein Commit)
5. `fastapi` + `starlette` + `uvicorn` + `pydantic*` *(Pytest komplett, dann Smoke)*

### Phase 3 — Backend Tooling
6. `pytest` 8 → 9 + plugins (low risk, nur Test-CI prüfen)
7. `black` + `isort` *(reformatiert ggf. viel Code; ein eigener Commit)*

### Phase 4 — Frontend Expo SDK 54 → 55
8. **Eigene Session.** Expo's Migration-Guide befolgen, alle expo-* zusammen.
   Webview / Bundle-Build / iOS+Android-Builds nach jedem Schritt prüfen.

### Phase 5 — Frontend Sonstiges
9. `eslint` 9 → 10 + `eslint-config-expo` 10 → 55 *(nach SDK-Migration)*
10. Restliche minors

## Hinweise zur Sicherheitslage
Wir haben aktuell keinen automatischen Audit. Empfehlung:
- Backend: `pip-audit` als CI-Check (siehe Batch-3.5 CI/CD).
- Frontend: `npm audit` als CI-Check.
- Beides bricht den Build erst bei "high" / "critical".
