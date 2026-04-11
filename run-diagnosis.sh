#!/bin/bash
set -e
echo "============================================"
echo "  Inventar Pro -- Vollständige Diagnose"
echo "============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

echo "[1/3] pytest-html installieren (falls nötig)..."
pip install pytest-html -q

echo "[2/3] Tests ausführen..."
echo ""
python3 -m pytest tests/ -v
EXIT=$?
echo ""

echo "[3/3] HTML-Report:"
if [ -f "diagnosis/report.html" ]; then
    echo "  $SCRIPT_DIR/backend/diagnosis/report.html"
else
    echo "  Kein Report generiert."
fi

echo ""
echo "============================================"
if [ $EXIT -eq 0 ]; then
    echo "  Ergebnis: ALLE TESTS BESTANDEN"
else
    echo "  Ergebnis: TESTS FEHLGESCHLAGEN -- Report pruefen"
fi
echo "============================================"
exit $EXIT
