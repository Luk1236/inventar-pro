"""Tests für kritische pi_dashboard Funktionen.

Run: pytest backend/tests/test_pi_dashboard.py -v
"""
import os
import sys
import time
import tempfile
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture
def dashboard_module(tmp_path, monkeypatch):
    """Lädt pi_dashboard mit temporärem Passwort-File."""
    pw_file = tmp_path / ".dashboard_password"
    monkeypatch.setattr(os.path, "expanduser", lambda p: str(tmp_path / p.lstrip("~/")) if p.startswith("~") else p)
    if "pi_dashboard" in sys.modules:
        del sys.modules["pi_dashboard"]
    import pi_dashboard
    if not hasattr(pi_dashboard, '_active_tokens'):
        pytest.skip("pi_dashboard vereinfachte Version – Auth-Features nicht verfügbar")
    pi_dashboard.DASH_PASSWORD_FILE = str(pw_file)
    pi_dashboard._active_tokens.clear()
    pi_dashboard._login_attempts.clear()
    return pi_dashboard


class TestShellWhitelist:
    """Sicherheits-Tests für die Shell-Whitelist."""

    def test_allows_safe_command(self, dashboard_module):
        assert dashboard_module._is_command_allowed("ls -la")
        assert dashboard_module._is_command_allowed("git status")
        assert dashboard_module._is_command_allowed("systemctl status mongod")

    def test_blocks_unknown_command(self, dashboard_module):
        assert not dashboard_module._is_command_allowed("rm -rf /")
        assert not dashboard_module._is_command_allowed("dd if=/dev/zero of=/dev/sda")
        assert not dashboard_module._is_command_allowed("nc -l 1234")

    def test_blocks_command_substitution(self, dashboard_module):
        assert not dashboard_module._is_command_allowed("$(rm -rf /)")
        assert not dashboard_module._is_command_allowed("`rm -rf /`")

    def test_blocks_empty(self, dashboard_module):
        assert not dashboard_module._is_command_allowed("")
        assert not dashboard_module._is_command_allowed("   ")

    def test_blocks_invalid_shlex(self, dashboard_module):
        assert not dashboard_module._is_command_allowed('echo "unclosed')

    def test_handles_path_prefix(self, dashboard_module):
        assert dashboard_module._is_command_allowed("/usr/bin/ls")
        assert dashboard_module._is_command_allowed("/bin/cat /etc/hostname")


class TestPasswordHashing:
    """Tests für bcrypt-Migration und Hashing."""

    def test_default_password_is_bcrypt(self, dashboard_module):
        h = dashboard_module._get_stored_hash()
        assert h.startswith("$2b$") or h.startswith("$2a$")

    def test_verify_correct_password(self, dashboard_module):
        assert dashboard_module._verify_password("admin")

    def test_verify_wrong_password(self, dashboard_module):
        assert not dashboard_module._verify_password("wrong")

    def test_password_file_permissions(self, dashboard_module):
        if os.name != "nt":
            stat = os.stat(dashboard_module.DASH_PASSWORD_FILE)
            assert stat.st_mode & 0o777 == 0o600

    def test_sha256_migration(self, dashboard_module):
        """Alter SHA-256 Hash wird beim erfolgreichen Login zu bcrypt migriert."""
        import hashlib
        sha = hashlib.sha256(b"testpass").hexdigest()
        dashboard_module._write_password_file(sha)
        assert dashboard_module._verify_password("testpass")
        with open(dashboard_module.DASH_PASSWORD_FILE) as f:
            new_hash = f.read().strip()
        assert new_hash.startswith("$2b$") or new_hash.startswith("$2a$")


class TestRateLimit:
    """Tests für Login-Brute-Force-Schutz."""

    def test_first_attempts_not_limited(self, dashboard_module):
        ip = "1.2.3.4"
        for _ in range(dashboard_module.MAX_LOGIN_ATTEMPTS - 1):
            dashboard_module._record_failed_login(ip)
        assert not dashboard_module._is_rate_limited(ip)

    def test_blocks_after_max(self, dashboard_module):
        ip = "1.2.3.5"
        for _ in range(dashboard_module.MAX_LOGIN_ATTEMPTS):
            dashboard_module._record_failed_login(ip)
        assert dashboard_module._is_rate_limited(ip)

    def test_separate_ips_independent(self, dashboard_module):
        ip1, ip2 = "1.1.1.1", "2.2.2.2"
        for _ in range(dashboard_module.MAX_LOGIN_ATTEMPTS):
            dashboard_module._record_failed_login(ip1)
        assert dashboard_module._is_rate_limited(ip1)
        assert not dashboard_module._is_rate_limited(ip2)


class TestSessionTokens:
    """Tests für Session-Management und Cleanup."""

    def test_token_cleanup_removes_expired(self, dashboard_module):
        old_token = "old"
        new_token = "new"
        now = time.time()
        dashboard_module._active_tokens[old_token] = now - dashboard_module.SESSION_TIMEOUT - 100
        dashboard_module._active_tokens[new_token] = now
        dashboard_module._cleanup_tokens()
        assert old_token not in dashboard_module._active_tokens
        assert new_token in dashboard_module._active_tokens
