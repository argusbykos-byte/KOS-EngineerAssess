"""NDA and Testing Integrity Agreement PDF generation service."""
import io
import os
from datetime import datetime
from app.utils.timezone import format_pacific_date, format_pacific_datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.pdfgen import canvas


# KOS company info
KOS_COMPANY_NAME = "KOS Inc."
KOS_ADDRESS = "KOS Stanford Research Park, Palo Alto, CA 94304"

# Testing Integrity Agreement text
TESTING_INTEGRITY_TEXT = """This assessment is designed to evaluate YOUR individual technical knowledge and skills.

By proceeding, the candidate certifies that:

• I will NOT use search engines (Google, Bing, etc.)
• I will NOT use AI assistants (ChatGPT, Claude, Copilot, Gemini, or any similar tools)
• I will NOT reference external code, documentation, or resources
• I will NOT communicate with others during the assessment
• All answers submitted are entirely my own work

Violations may result in immediate disqualification and withdrawal of candidacy."""

# Mutual Arbitration Agreement text
ARBITRATION_AGREEMENT_TEXT = """KOS INC.
MUTUAL ARBITRATION AGREEMENT FOR EMPLOYMENT RELATED CLAIMS & DISPUTES

Although KOS Inc. ("KOS") hopes that employment disputes with its employees will not occur, KOS believes that when such disputes do arise, it is in the mutual interest of all concerned to handle them promptly and with a minimum disturbance to the operations of KOS's businesses and the lives of its employees. Accordingly, to provide for a more expeditious resolution of employment-related claims and disputes that may arise between KOS and the undersigned ("Candidate"), both KOS and Candidate (collectively the "Parties") hereby agree to mandatory arbitration for any and all claims and disputes that arise or may arise from Candidate's potential employment with KOS, except as provided for herein.

MUTUAL ARBITRATION AGREEMENT. The Parties mutually agree that any and all controversies, claims, or disputes arising out of, relating to, or resulting from Candidate's potential employment with KOS or any employment-related matters shall be subject to binding arbitration under the Federal Arbitration Act and administered by Judicial Arbitration & Mediation Services ("JAMS") in accordance with its Employment Arbitration Rules and Procedures then in effect.

PROCEDURE. Both parties mutually agree that any arbitration under this Mutual Arbitration Agreement will be (a) brought forth in San Jose, California; and (b) administered by the rules set forth by JAMS Employment Arbitration Rules and Procedures.

CALIFORNIA LAW APPLIES. Candidate and KOS agree that this Agreement will be interpreted in accordance with and governed for all purposes by the laws of the State of California.

VOLUNTARY NATURE OF AGREEMENT. Candidate acknowledges and agrees that they are executing this Agreement voluntarily and without any duress or undue influence.

BOTH PARTIES UNDERSTAND THAT BY AGREEING TO THE TERMS OF THIS MUTUAL ARBITRATION AGREEMENT, BOTH ARE WAIVING THEIR RIGHTS TO HAVE ANY COVERED CLAIM(S) DECIDED IN A COURT OF LAW BEFORE A JUDGE OR A JURY."""


def generate_nda_pdf(
    candidate_name: str,
    signature: str,
    signed_at: datetime,
    ip_address: str,
    integrity_agreed: bool = True,
    nda_agreed: bool = True,
) -> bytes:
    """Generate PDF of signed NDA and Testing Integrity Agreement.

    Args:
        candidate_name: Full name of the candidate
        signature: Typed signature (full legal name)
        signed_at: Timestamp when agreement was signed (UTC)
        ip_address: IP address from which agreement was signed
        integrity_agreed: Whether testing integrity was agreed to
        nda_agreed: Whether arbitration agreement was agreed to

    Returns:
        PDF file as bytes
    """
    buffer = io.BytesIO()

    # Create document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    # Get styles
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1a365d'),
        spaceAfter=12,
        alignment=TA_CENTER,
    )

    company_style = ParagraphStyle(
        'CompanyName',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a365d'),
        spaceAfter=6,
        alignment=TA_CENTER,
    )

    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2d3748'),
        spaceBefore=20,
        spaceAfter=10,
        alignment=TA_LEFT,
    )

    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#4a5568'),
        alignment=TA_JUSTIFY,
        spaceAfter=8,
        leading=14,
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#4a5568'),
        leftIndent=20,
        spaceAfter=4,
        leading=14,
    )

    signature_style = ParagraphStyle(
        'SignatureText',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#2d3748'),
        spaceAfter=6,
    )

    footer_style = ParagraphStyle(
        'FooterText',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#718096'),
        alignment=TA_CENTER,
    )

    # Build document content
    story = []

    # Header
    story.append(Paragraph(KOS_COMPANY_NAME, company_style))
    story.append(Paragraph("Technical Assessment Agreement", title_style))
    story.append(Spacer(1, 20))

    # Candidate info
    story.append(Paragraph(f"<b>Candidate:</b> {candidate_name}", body_style))
    story.append(Spacer(1, 10))

    # Testing Integrity Agreement Section
    story.append(Paragraph("SECTION 1: TESTING INTEGRITY CERTIFICATION", section_title_style))

    # Split the integrity text for better formatting
    integrity_intro = "This assessment is designed to evaluate YOUR individual technical knowledge and skills."
    story.append(Paragraph(integrity_intro, body_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>By proceeding, the candidate certifies that:</b>", body_style))

    # Bullet points
    bullets = [
        "I will NOT use search engines (Google, Bing, etc.)",
        "I will NOT use AI assistants (ChatGPT, Claude, Copilot, Gemini, or any similar tools)",
        "I will NOT reference external code, documentation, or resources",
        "I will NOT communicate with others during the assessment",
        "All answers submitted are entirely my own work",
    ]
    for bullet in bullets:
        story.append(Paragraph(f"• {bullet}", bullet_style))

    story.append(Spacer(1, 10))
    warning_style = ParagraphStyle(
        'Warning',
        parent=body_style,
        textColor=colors.HexColor('#c53030'),
        fontName='Helvetica-Bold',
    )
    story.append(Paragraph("⚠ Violations may result in immediate disqualification and withdrawal of candidacy.", warning_style))

    story.append(Spacer(1, 20))

    # Mutual Arbitration Agreement Section
    story.append(Paragraph("SECTION 2: MUTUAL ARBITRATION AGREEMENT", section_title_style))

    # Split arbitration agreement into paragraphs
    arb_paragraphs = ARBITRATION_AGREEMENT_TEXT.split('\n\n')
    for para in arb_paragraphs:
        if para.strip():
            # Clean up the text
            clean_para = para.strip().replace('\n', ' ')
            story.append(Paragraph(clean_para, body_style))

    story.append(Spacer(1, 30))

    # Signature Section
    story.append(Paragraph("DIGITAL SIGNATURE", section_title_style))

    # Checkbox indicators
    check_mark = "☑" if integrity_agreed else "☐"
    story.append(Paragraph(f"{check_mark} I agree to the Testing Integrity Agreement", signature_style))

    check_mark = "☑" if nda_agreed else "☐"
    story.append(Paragraph(f"{check_mark} I have read and agree to the Mutual Arbitration Agreement", signature_style))

    story.append(Spacer(1, 20))

    # Signature details in a table for better formatting
    formatted_date = format_pacific_date(signed_at, "%B %d, %Y")
    formatted_timestamp = format_pacific_datetime(signed_at)

    signature_data = [
        ["Signed by:", signature],
        ["Date:", formatted_date],
        ["IP Address:", ip_address or "Not recorded"],
        ["Timestamp:", formatted_timestamp],
    ]

    signature_table = Table(signature_data, colWidths=[1.5*inch, 4*inch])
    signature_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2d3748')),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))

    story.append(signature_table)

    story.append(Spacer(1, 40))

    # Footer
    story.append(Paragraph(f"This document was electronically signed and is legally binding.", footer_style))
    story.append(Paragraph(KOS_ADDRESS, footer_style))

    # Build PDF
    doc.build(story)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes


class NDAService:
    """Service for NDA and agreement management."""

    async def generate_signed_agreement_pdf(
        self,
        candidate_name: str,
        signature: str,
        signed_at: datetime,
        ip_address: str,
        integrity_agreed: bool = True,
        nda_agreed: bool = True,
    ) -> bytes:
        """Generate PDF of signed agreement."""
        return generate_nda_pdf(
            candidate_name=candidate_name,
            signature=signature,
            signed_at=signed_at,
            ip_address=ip_address,
            integrity_agreed=integrity_agreed,
            nda_agreed=nda_agreed,
        )


nda_service = NDAService()
