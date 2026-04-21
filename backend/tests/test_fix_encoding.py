# backend/tests/test_fix_encoding.py
"""Unit-Tests für fix_encoding.py — Dry-Run, Checkpoint, Logging."""
import json
import sys
import pytest
from pathlib import Path

# fix_encoding.py liegt in backend/, nicht in tests/
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_checkpoint_created_on_write(tmp_path, monkeypatch):
    """Nach save_checkpoint() muss die Checkpoint-Datei existieren."""
    import fix_encoding

    checkpoint_file = tmp_path / "checkpoint.json"
    monkeypatch.setattr(fix_encoding, "CHECKPOINT_FILE", checkpoint_file)

    assert not checkpoint_file.exists()
    fix_encoding.save_checkpoint({"articles": "507f1f77bcf86cd799439011"})

    assert checkpoint_file.exists()
    data = json.loads(checkpoint_file.read_text())
    assert data.get("articles") == "507f1f77bcf86cd799439011"


def test_checkpoint_loaded_on_restart(tmp_path, monkeypatch):
    """load_checkpoint() muss gespeicherten Checkpoint korrekt laden."""
    import fix_encoding

    checkpoint_file = tmp_path / "checkpoint.json"
    checkpoint_file.write_text(json.dumps({"articles": "abc123", "bookings": None}))
    monkeypatch.setattr(fix_encoding, "CHECKPOINT_FILE", checkpoint_file)

    result = fix_encoding.load_checkpoint()
    assert result["articles"] == "abc123"
    assert result["bookings"] is None


def test_corrupt_checkpoint_returns_fresh(tmp_path, monkeypatch):
    """Korrupte Checkpoint-Datei muss graceful behandelt werden (kein Crash)."""
    import fix_encoding

    checkpoint_file = tmp_path / "checkpoint.json"
    checkpoint_file.write_text("{INVALID JSON{{")
    monkeypatch.setattr(fix_encoding, "CHECKPOINT_FILE", checkpoint_file)

    result = fix_encoding.load_checkpoint()
    assert isinstance(result, dict)
    for val in result.values():
        assert val is None


def test_reset_checkpoint_deletes_file(tmp_path, monkeypatch):
    """--reset-checkpoint muss die Checkpoint-Datei löschen."""
    import fix_encoding

    checkpoint_file = tmp_path / "checkpoint.json"
    checkpoint_file.write_text('{"articles": "123"}')
    monkeypatch.setattr(fix_encoding, "CHECKPOINT_FILE", checkpoint_file)

    fix_encoding.delete_checkpoint()
    assert not checkpoint_file.exists()


def test_atomic_checkpoint_write(tmp_path, monkeypatch):
    """save_checkpoint() darf keine .tmp Datei hinterlassen."""
    import fix_encoding

    checkpoint_file = tmp_path / "checkpoint.json"
    monkeypatch.setattr(fix_encoding, "CHECKPOINT_FILE", checkpoint_file)

    fix_encoding.save_checkpoint({"articles": "test123"})

    tmp_file = checkpoint_file.with_suffix(".tmp")
    assert not tmp_file.exists(), ".tmp Datei wurde nicht bereinigt (atomisches Schreiben fehlgeschlagen)"
    assert checkpoint_file.exists()
