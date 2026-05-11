"""Label-Druck-Endpoints."""
import os
from fastapi import APIRouter, Depends, HTTPException, Body, Response
from app.services.label_print import (
    generate_zpl, generate_tspl, generate_label_pdf, send_to_network_printer
)
from app.deps.auth import get_current_user

router = APIRouter(prefix="/labels", tags=["labels"])


@router.post("/zpl")
async def labels_zpl(payload: dict = Body(...), current_user=Depends(get_current_user)):
    """Erzeugt ZPL-Code für Zebra-Drucker. Optional direkt an Netzwerkdrucker senden."""
    title = payload.get("title", "").strip()
    code = payload.get("code", "").strip()
    if not title or not code:
        raise HTTPException(400, "title und code sind erforderlich")
    extras = payload.get("extra_lines", [])
    code_type = payload.get("code_type", "QR")
    zpl = generate_zpl(title=title, code=code, code_type=code_type, extra_lines=extras)

    printer_host = payload.get("printer_host") or os.environ.get("LABEL_PRINTER_HOST")
    printer_port = int(payload.get("printer_port") or os.environ.get("LABEL_PRINTER_PORT", "9100"))
    if printer_host:
        try:
            send_to_network_printer(printer_host, printer_port, zpl)
            return {"ok": True, "msg": f"An {printer_host}:{printer_port} gesendet", "zpl": zpl}
        except Exception as e:
            raise HTTPException(502, f"Drucker nicht erreichbar: {e}")
    return {"ok": True, "zpl": zpl, "msg": "Kein printer_host — ZPL nur generiert"}


@router.post("/tspl")
async def labels_tspl(payload: dict = Body(...), current_user=Depends(get_current_user)):
    """TSPL für TSC/Brother-Drucker."""
    title = payload.get("title", "").strip()
    code = payload.get("code", "").strip()
    if not title or not code:
        raise HTTPException(400, "title und code sind erforderlich")
    tspl = generate_tspl(title=title, code=code, extra_lines=payload.get("extra_lines", []))
    printer_host = payload.get("printer_host") or os.environ.get("LABEL_PRINTER_HOST")
    if printer_host:
        port = int(payload.get("printer_port") or 9100)
        try:
            send_to_network_printer(printer_host, port, tspl)
            return {"ok": True, "msg": f"An {printer_host}:{port} gesendet", "tspl": tspl}
        except Exception as e:
            raise HTTPException(502, f"Drucker nicht erreichbar: {e}")
    return {"ok": True, "tspl": tspl}


@router.post("/pdf")
async def labels_pdf(payload: dict = Body(...), current_user=Depends(get_current_user)):
    """Erzeugt PDF-Etikett (Standard 60×40mm)."""
    title = payload.get("title", "").strip()
    code = payload.get("code", "").strip()
    if not title or not code:
        raise HTTPException(400, "title und code sind erforderlich")
    try:
        pdf = generate_label_pdf(
            title=title, code=code,
            extra_lines=payload.get("extra_lines", []),
            width_mm=float(payload.get("width_mm", 60)),
            height_mm=float(payload.get("height_mm", 40)),
        )
    except Exception as e:
        raise HTTPException(500, f"PDF-Erzeugung fehlgeschlagen: {e}")
    return Response(content=pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="label_{code}.pdf"'
    })
