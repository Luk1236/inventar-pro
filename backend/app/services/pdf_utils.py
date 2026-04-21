# app/services/pdf_utils.py
# PDF generation utilities with letterhead support
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from io import BytesIO

def get_company_header(parent_style: ParagraphStyle) -> tuple:
    """Get company header elements."""
    return (
        Paragraph("Inventar Pro", parent_style),
        Paragraph("Event & Rental Management", parent_style),
        Spacer(1, 0.5*cm),
    )

def get_company_footer() -> tuple:
    """Get company footer elements."""
    from datetime import datetime, timezone

    return (
        Spacer(1, 1*cm),
        Paragraph(
            f"Erstellt am {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')}\n"
            "Dokument automatisch generiert - Keine Abrechnung und Überprüfung.",
            getSampleStyleSheet()['Normal']
        ),
    )

def create_pdf_with_letterhead(
    title: str,
    buffer: BytesIO,
    company_header: bool = True,
    pagesize = None,
    margins: dict = None
) -> SimpleDocTemplate:
    """Create a PDF document with letterhead."""
    if pagesize is None:
        pagesize = landscape(A4)
    if margins is None:
        margins = {
            'top': 2*cm if company_header else 1*cm,
            'bottom': 2 * cm,
            'left': 2 * cm,
            'right': 2 * cm,
        }

    doc = SimpleDocTemplate(buffer, pagesize=pagesize, **margins)
    return doc

def generate_pdf_with_branding(
    elements: list,
    title: str,
    company_header: bool = True
) -> bytes:
    """Generate a PDF with branding and letterhead."""
    buffer = BytesIO()
    doc = create_pdf_with_letterhead(title, buffer, company_header)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#007AFF'),
        spaceAfter=30,
        alignment=1  # TA_CENTER
    )

    elements.insert(0, Paragraph(title, title_style))
    elements.insert(1, Spacer(1, 0.5*cm))

    if company_header:
        for item in get_company_header(styles['Normal']):
            elements.insert(2, item)
        elements.insert(3, Spacer(1, 1*cm))

    # Footer is handled by SimpleDocTemplate via onLaterPages
    doc.build(elements, onLaterPages=get_company_footer())

    return buffer.getvalue()