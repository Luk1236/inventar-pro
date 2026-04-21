# backend/tests/test_v1_router.py
"""Verifiziert, dass /api/v1/ Routen existieren und korrekte Metadaten haben."""
import pytest


@pytest.mark.asyncio
async def test_v1_articles_returns_same_as_v0(client, auth_headers):
    """/api/v1/articles muss dieselbe Antwort liefern wie /api/articles."""
    resp_v0 = await client.get("/api/articles", headers=auth_headers)
    resp_v1 = await client.get("/api/v1/articles", headers=auth_headers)

    assert resp_v0.status_code == 200, f"/api/articles: {resp_v0.status_code}"
    assert resp_v1.status_code == 200, (
        f"/api/v1/articles: {resp_v1.status_code}. "
        "Fehler: v1 Route ist nicht registriert."
    )
    assert resp_v0.json() == resp_v1.json(), (
        "v0 und v1 liefern unterschiedliche Daten!"
    )


@pytest.mark.asyncio
async def test_v1_openapi_has_response_model(client):
    """OpenAPI-Schema unter /api/v1/ muss response_model-Infos enthalten."""
    resp = await client.get("/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()

    paths = schema.get("paths", {})

    # Prüfe, dass /api/v1/articles in der OpenAPI-Spec vorhanden ist
    v1_path = "/api/v1/articles"
    assert v1_path in paths, (
        f"{v1_path} fehlt in OpenAPI-Spec. "
        "Fehler: v1 Router wurde nicht registriert oder Metadaten gehen verloren."
    )

    # Prüfe, dass die Route ein response-Schema hat (kein leeres {})
    get_op = paths[v1_path].get("get", {})
    responses = get_op.get("responses", {})
    assert "200" in responses, f"Keine 200-Antwort definiert für {v1_path}"
    response_200 = responses["200"]
    # Wenn response_model korrekt kopiert wurde, gibt es einen content-Block
    assert "content" in response_200, (
        f"Kein 'content' in 200-Antwort für {v1_path}. "
        "Fehler: response_model wurde beim Kopieren der Route nicht übertragen."
    )
