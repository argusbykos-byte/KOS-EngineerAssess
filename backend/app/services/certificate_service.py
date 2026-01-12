"""Certificate PDF generation service."""
import io
import os
import qrcode
from datetime import datetime
from app.utils.timezone import format_pacific_date
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage


# KOS company info - Updated address
KOS_COMPANY_NAME = "KOS (Kernel of Science)"
KOS_ADDRESS = "KOS Stanford Research Park, Palo Alto, CA 94304"
KOS_TAGLINE = "Advancing Biomedical Engineering Through Innovation"

# Path to logo file
LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets", "quest_logo.png")


def get_track_title(track: str, categories: list = None) -> str:
    """Get human-readable track title."""
    track_map = {
        "signal_processing": "Biomedical Signal Processing Engineer",
        "llm": "ML/AI Engineer",
    }
    if track and track in track_map:
        return track_map[track]

    # Fallback to categories
    if categories:
        if "signal_processing" in categories:
            return "Biomedical Signal Processing Engineer"
        if "coding" in categories and "system_design" in categories:
            return "Software Engineer"
        if "coding" in categories:
            return "Software Developer"

    return "Engineering Assessment"


def generate_qr_code(data: str, size: int = 100) -> io.BytesIO:
    """Generate QR code image."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,  # Medium error correction for better scanning
        box_size=10,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer


def create_watermark_logo(opacity: float = 0.15) -> io.BytesIO:
    """Create a transparent watermark from the logo.

    Args:
        opacity: Opacity level (0.15 = 15% opacity / 85% transparency)

    Returns:
        BytesIO buffer with transparent PNG
    """
    if not os.path.exists(LOGO_PATH):
        return None

    try:
        # Open the logo
        logo = PILImage.open(LOGO_PATH).convert("RGBA")

        # Create a new image with adjusted alpha
        r, g, b, a = logo.split()

        # Adjust alpha channel for transparency
        a = a.point(lambda x: int(x * opacity))

        # Merge back
        watermark = PILImage.merge("RGBA", (r, g, b, a))

        buffer = io.BytesIO()
        watermark.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer
    except Exception as e:
        print(f"Error creating watermark: {e}")
        return None


def generate_certificate_pdf(
    certificate_id: str,
    candidate_name: str,
    test_date: datetime,
    track: str,
    score_tier: str,
    overall_score: float,
    verification_url: str,
    categories: list = None,
) -> bytes:
    """Generate professional PDF certificate with watermark background.

    Args:
        certificate_id: Unique certificate ID (e.g., KOS-20241215-ABC12)
        candidate_name: Full name of the candidate
        test_date: Date when test was completed
        track: Track/specialization (signal_processing, llm, etc.)
        score_tier: Performance tier (Distinguished, Proficient, Passed, Did Not Pass)
        overall_score: Numeric score (0-100)
        verification_url: URL for QR code verification
        categories: List of assessment categories

    Returns:
        PDF file as bytes
    """
    buffer = io.BytesIO()

    # Use landscape letter size for certificate
    page_width, page_height = landscape(letter)

    # Create canvas directly for more control over watermark
    c = canvas.Canvas(buffer, pagesize=landscape(letter))

    # Draw watermark logo first (background)
    watermark_buffer = create_watermark_logo(opacity=0.15)
    if watermark_buffer:
        try:
            # Calculate center position for watermark
            # Make watermark large - about 60% of page width
            watermark_width = page_width * 0.6
            watermark_height = page_height * 0.6

            x = (page_width - watermark_width) / 2
            y = (page_height - watermark_height) / 2

            # Use ImageReader for BytesIO objects
            watermark_img = ImageReader(watermark_buffer)
            c.drawImage(
                watermark_img,
                x, y,
                width=watermark_width,
                height=watermark_height,
                preserveAspectRatio=True,
                mask='auto'
            )
        except Exception as e:
            print(f"Error drawing watermark: {e}")

    # Define colors
    dark_blue = colors.HexColor('#1a365d')
    gray = colors.HexColor('#4a5568')
    light_gray = colors.HexColor('#718096')

    tier_colors = {
        "Distinguished": colors.HexColor('#D4AF37'),  # Gold
        "Proficient": colors.HexColor('#C0C0C0'),     # Silver
        "Passed": colors.HexColor('#CD7F32'),         # Bronze
        "Did Not Pass": colors.HexColor('#718096'),   # Gray
    }
    tier_color = tier_colors.get(score_tier, colors.HexColor('#718096'))

    # Starting Y position from top
    y_pos = page_height - 60

    # Company name
    c.setFont("Helvetica-Bold", 36)
    c.setFillColor(dark_blue)
    c.drawCentredString(page_width / 2, y_pos, KOS_COMPANY_NAME)

    # Tagline
    y_pos -= 30
    c.setFont("Helvetica", 14)
    c.setFillColor(gray)
    c.drawCentredString(page_width / 2, y_pos, KOS_TAGLINE)

    # Decorative line
    y_pos -= 25
    c.setStrokeColor(colors.HexColor('#e2e8f0'))
    c.setLineWidth(1)
    c.line(100, y_pos, page_width - 100, y_pos)

    # Certificate title
    y_pos -= 40
    c.setFont("Helvetica", 18)
    c.setFillColor(light_gray)
    c.drawCentredString(page_width / 2, y_pos, "Certificate of Completion")

    # "This certifies that"
    y_pos -= 35
    c.setFont("Helvetica", 14)
    c.setFillColor(gray)
    c.drawCentredString(page_width / 2, y_pos, "This certifies that")

    # Candidate name
    y_pos -= 35
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(colors.HexColor('#2d3748'))
    c.drawCentredString(page_width / 2, y_pos, candidate_name)

    # Track/Assessment description
    y_pos -= 30
    c.setFont("Helvetica", 14)
    c.setFillColor(gray)
    track_title = get_track_title(track, categories)
    c.drawCentredString(page_width / 2, y_pos, f"has successfully completed the {track_title} Assessment")

    # Achievement level
    y_pos -= 45
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(tier_color)
    c.drawCentredString(page_width / 2, y_pos, f"Achievement Level: {score_tier}")

    # Score
    y_pos -= 30
    c.setFont("Helvetica", 14)
    c.setFillColor(gray)
    c.drawCentredString(page_width / 2, y_pos, f"Overall Score: {int(overall_score)}%")

    # Date - Convert to Pacific Time for display
    y_pos -= 35
    formatted_date = format_pacific_date(test_date, "%B %d, %Y")
    c.drawCentredString(page_width / 2, y_pos, f"Awarded on {formatted_date}")

    # Certificate ID
    y_pos -= 25
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor('#a0aec0'))
    c.drawCentredString(page_width / 2, y_pos, f"Certificate ID: {certificate_id}")

    # QR Code - positioned at bottom right
    qr_buffer = generate_qr_code(verification_url, size=80)
    qr_x = page_width - 120
    qr_y = 50
    qr_img = ImageReader(qr_buffer)
    c.drawImage(qr_img, qr_x, qr_y, width=70, height=70)

    # "Scan to verify" text under QR
    c.setFont("Helvetica", 8)
    c.setFillColor(light_gray)
    c.drawCentredString(qr_x + 35, qr_y - 12, "Scan to verify")

    # Footer with address
    c.setFont("Helvetica", 9)
    c.setFillColor(light_gray)
    c.drawCentredString(page_width / 2, 30, KOS_ADDRESS)

    # Finalize the PDF
    c.save()

    # Get PDF bytes
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes


class CertificateService:
    """Service for certificate generation and management."""

    def __init__(self):
        self.base_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')

    def get_verification_url(self, certificate_id: str) -> str:
        """Generate verification URL for certificate.

        Uses the configured FRONTEND_URL to create a proper verification link.
        """
        # Ensure we have a proper URL
        base = self.base_url.rstrip('/')
        return f"{base}/verify/{certificate_id}"

    async def generate_certificate(
        self,
        certificate_id: str,
        candidate_name: str,
        test_date: datetime,
        track: str,
        score_tier: str,
        overall_score: float,
        categories: list = None,
    ) -> bytes:
        """Generate certificate PDF."""
        verification_url = self.get_verification_url(certificate_id)

        return generate_certificate_pdf(
            certificate_id=certificate_id,
            candidate_name=candidate_name,
            test_date=test_date,
            track=track,
            score_tier=score_tier,
            overall_score=overall_score,
            verification_url=verification_url,
            categories=categories,
        )


certificate_service = CertificateService()
