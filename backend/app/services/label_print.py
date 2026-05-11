"""Label-Druck-Services: ZPL (Zebra), TSPL (TSC/Brother) und PDF.

Unterstützte Formate:
- ZPL: Zebra-Drucker (TCP-Port 9100 oder USB)
- TSPL: TSC/Brother QL-Drucker
- PDF: Universal, druckbar via Browser/Standard-Drucker
"""
from __future__ import annotations
import io
import socket
from typing import Optional


def generate_zpl(
    *,
    title: str,
    code: str,
    code_type: str = "QR",
    extra_lines: list[str] | None = None,
    label_width_dots: int = 480,
    label_height_dots: int = 320,
) -> str:
    """Erzeugt ZPL-Code für 60×40mm-Etikett (203dpi).

    code_type: "QR" oder "BARCODE" (Code128).
    """
    lines = [
        "^XA",
        f"^PW{label_width_dots}",
        f"^LL{label_height_dots}",
        "^LH0,0",
        "^CI28",  # UTF-8
        f"^FO20,20^A0N,32,32^FD{title[:30]}^FS",
    ]
    if code_type == "QR":
        lines += [
            "^FO20,70^BQN,2,6",
            f"^FDLA,{code}^FS",
            f"^FO180,80^A0N,22,22^FD{code}^FS",
        ]
    else:
        lines += [
            "^FO20,70^BCN,80,Y,N,N",
            f"^FD{code}^FS",
        ]
    y = 200
    for line in (extra_lines or [])[:3]:
        lines.append(f"^FO20,{y}^A0N,22,22^FD{line[:40]}^FS")
        y += 28
    lines.append("^XZ")
    return "\n".join(lines)


def generate_tspl(*, title: str, code: str, extra_lines: list[str] | None = None) -> str:
    """TSPL für Brother QL/TSC-Drucker, 62×29mm Standard-Endlosrolle."""
    cmds = [
        "SIZE 62 mm,29 mm",
        "GAP 3 mm,0 mm",
        "DENSITY 8",
        "DIRECTION 1",
        "REFERENCE 0,0",
        "CLS",
        f'TEXT 20,10,"3",0,1,1,"{title[:30]}"',
        f'QRCODE 20,50,L,4,A,0,"{code}"',
        f'TEXT 130,55,"2",0,1,1,"{code}"',
    ]
    y = 130
    for line in (extra_lines or [])[:2]:
        cmds.append(f'TEXT 20,{y},"2",0,1,1,"{line[:40]}"')
        y += 22
    cmds += ["PRINT 1,1", ""]
    return "\n".join(cmds)


def send_to_network_printer(host: str, port: int, payload: str, timeout: int = 5) -> None:
    """Sendet rohen Druck-Payload via TCP an Netzwerkdrucker (z.B. Zebra Port 9100)."""
    with socket.create_connection((host, port), timeout=timeout) as s:
        s.sendall(payload.encode("utf-8"))


def generate_label_pdf(
    *,
    title: str,
    code: str,
    extra_lines: list[str] | None = None,
    width_mm: float = 60,
    height_mm: float = 40,
) -> bytes:
    """Generiert PDF-Etikett mit reportlab + qrcode."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import mm
    try:
        import qrcode
    except ImportError:
        raise RuntimeError("qrcode Paket nicht installiert: pip install qrcode[pil]")

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width_mm * mm, height_mm * mm))

    c.setFont("Helvetica-Bold", 9)
    c.drawString(3 * mm, (height_mm - 5) * mm, title[:40])

    qr = qrcode.QRCode(box_size=2, border=1)
    qr.add_data(code)
    qr.make()
    img = qr.make_image(fill_color="black", back_color="white")
    img_buf = io.BytesIO()
    img.save(img_buf, format="PNG")
    img_buf.seek(0)
    from reportlab.lib.utils import ImageReader
    c.drawImage(ImageReader(img_buf), 3 * mm, 3 * mm, 22 * mm, 22 * mm)

    c.setFont("Helvetica", 7)
    text_y = (height_mm - 12) * mm
    c.drawString(28 * mm, text_y, code[:30])
    text_y -= 4 * mm
    for line in (extra_lines or [])[:4]:
        c.drawString(28 * mm, text_y, line[:35])
        text_y -= 3.5 * mm

    c.showPage()
    c.save()
    return buf.getvalue()
