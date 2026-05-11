"""AI-gestützte Bilderkennung für Inventar-Artikel.

Unterstützt:
- Anthropic Claude Vision (bevorzugt, env: ANTHROPIC_API_KEY)
- OpenAI GPT-4 Vision (fallback, env: OPENAI_API_KEY)

Falls keine API-Keys gesetzt sind, gibt der Service eine klare Fehlermeldung zurück.
"""
from __future__ import annotations
import base64
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
AI_MODEL_ANTHROPIC = os.environ.get("AI_VISION_MODEL_ANTHROPIC", "claude-sonnet-4-5")
AI_MODEL_OPENAI = os.environ.get("AI_VISION_MODEL_OPENAI", "gpt-4o-mini")

ARTICLE_DETECTION_PROMPT = """Du bist ein Inventar-Assistent. Analysiere das Bild und extrahiere Artikel-Informationen.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "name": "kurzer Artikelname (max 60 Zeichen)",
  "description": "ausführliche Beschreibung (1-2 Sätze)",
  "category_hint": "vermutete Kategorie (z.B. Beleuchtung, Audio, Stromverteilung, Werkzeug, ...)",
  "serial_number": "Seriennummer falls sichtbar, sonst null",
  "manufacturer": "Hersteller falls erkennbar, sonst null",
  "model": "Modellbezeichnung falls erkennbar, sonst null",
  "estimated_quantity": 1,
  "condition": "neu/gebraucht/defekt",
  "confidence": 0.0-1.0,
  "notes": "Auffälligkeiten oder weitere Hinweise"
}

Wenn du dir bei einem Feld unsicher bist, setze null. Gib NIEMALS Markdown oder zusätzlichen Text zurück — nur das JSON-Objekt.
"""


class AIVisionError(Exception):
    pass


def _strip_data_url(b64: str) -> tuple[str, str]:
    """Extracts media-type + raw base64 from data URL or plain b64."""
    if b64.startswith("data:"):
        header, _, data = b64.partition(",")
        media = header.split(";")[0].replace("data:", "") or "image/jpeg"
        return media, data
    return "image/jpeg", b64


def _parse_json_response(text: str) -> dict:
    """Robustly extract JSON from LLM response (sometimes wrapped in code fences)."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(l for l in lines if not l.startswith("```"))
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise AIVisionError(f"Keine JSON-Antwort: {text[:200]}")
    return json.loads(text[start:end + 1])


def detect_article_from_image(image_b64: str) -> dict:
    """Hauptfunktion: erkennt Artikel-Daten aus base64-Bild.

    Returns: dict mit Artikel-Daten (siehe ARTICLE_DETECTION_PROMPT).
    Raises: AIVisionError bei Fehler oder fehlender Konfiguration.
    """
    media_type, b64 = _strip_data_url(image_b64)

    if ANTHROPIC_API_KEY:
        return _detect_anthropic(b64, media_type)
    if OPENAI_API_KEY:
        return _detect_openai(b64, media_type)
    raise AIVisionError(
        "Kein API-Key konfiguriert. Setze ANTHROPIC_API_KEY oder OPENAI_API_KEY in der Backend-.env"
    )


def _detect_anthropic(b64: str, media_type: str) -> dict:
    try:
        import anthropic
    except ImportError:
        raise AIVisionError("anthropic Paket nicht installiert. Backend: pip install anthropic")
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model=AI_MODEL_ANTHROPIC,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": ARTICLE_DETECTION_PROMPT},
            ],
        }],
    )
    text = msg.content[0].text if msg.content else ""
    return _parse_json_response(text)


def _detect_openai(b64: str, media_type: str) -> dict:
    try:
        from openai import OpenAI
    except ImportError:
        raise AIVisionError("openai Paket nicht installiert. Backend: pip install openai")
    client = OpenAI(api_key=OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model=AI_MODEL_OPENAI,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": ARTICLE_DETECTION_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}},
            ],
        }],
    )
    text = resp.choices[0].message.content or ""
    return _parse_json_response(text)


def is_available() -> tuple[bool, str]:
    """Prüft ob mindestens ein Provider konfiguriert ist."""
    if ANTHROPIC_API_KEY:
        return True, "anthropic"
    if OPENAI_API_KEY:
        return True, "openai"
    return False, "kein API-Key konfiguriert"
