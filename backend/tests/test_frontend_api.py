# backend/tests/test_frontend_api.py
"""
Führt die Frontend Jest-Tests als Teil der Gesamtdiagnose aus.
Braucht Node.js + npm (im frontend/-Verzeichnis).
"""
import subprocess
import os
import pytest


FRONTEND_DIR = os.path.normpath(os.path.join(
    os.path.dirname(__file__), "..", "..", "frontend"
))


def test_frontend_jest_suite():
    """Frontend Jest-Tests (apiService URL-Logik) via Subprocess."""
    if not os.path.isdir(FRONTEND_DIR):
        pytest.skip(f"Frontend-Verzeichnis nicht gefunden: {FRONTEND_DIR}")

    result = subprocess.run(
        ["npx", "jest", "__tests__/apiService.test.ts", "--no-coverage", "--forceExit", "--ci"],
        cwd=FRONTEND_DIR,
        capture_output=True,
        text=True,
        timeout=120,
        shell=True,  # Windows-kompatibel
    )

    output = result.stdout + "\n" + result.stderr
    assert result.returncode == 0, (
        f"Frontend Jest-Tests fehlgeschlagen (exit code {result.returncode}):\n{output}"
    )
