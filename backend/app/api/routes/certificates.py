from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime

from app.database import get_db
from app.models import Report, Test, Candidate, Certificate, get_score_tier
from app.schemas.certificate import CertificateResponse, CertificateVerification
from app.services.certificate_service import certificate_service

router = APIRouter()


@router.post("/generate/{report_id}", response_model=CertificateResponse)
async def generate_certificate(report_id: int, db: AsyncSession = Depends(get_db)):
    """Generate a certificate for a completed report."""
    # Get report with test and candidate
    query = (
        select(Report)
        .options(
            selectinload(Report.test).selectinload(Test.candidate),
            selectinload(Report.certificate)
        )
        .where(Report.id == report_id)
    )
    result = await db.execute(query)
    report = result.scalars().first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Check if certificate already exists
    if report.certificate:
        return CertificateResponse(
            id=report.certificate.id,
            report_id=report.certificate.report_id,
            certificate_id=report.certificate.certificate_id,
            candidate_name=report.certificate.candidate_name,
            test_date=report.certificate.test_date,
            track=report.certificate.track,
            score_tier=report.certificate.score_tier,
            overall_score=report.certificate.overall_score,
            verification_url=report.certificate.verification_url,
            created_at=report.certificate.created_at,
            has_pdf=report.certificate.pdf_data is not None
        )

    # Get candidate info
    candidate = report.test.candidate
    test = report.test

    # Determine score tier
    score_tier = get_score_tier(report.overall_score or 0)

    # Determine track title
    track = candidate.track

    # Create certificate record
    from app.models.certificate import generate_certificate_id
    cert_id = generate_certificate_id()

    certificate = Certificate(
        report_id=report.id,
        certificate_id=cert_id,
        candidate_name=candidate.name,
        test_date=test.end_time or test.start_time or datetime.utcnow(),
        track=track,
        score_tier=score_tier,
        overall_score=int(report.overall_score or 0),
        verification_url=certificate_service.get_verification_url(cert_id),
    )

    # Generate PDF
    pdf_bytes = await certificate_service.generate_certificate(
        certificate_id=cert_id,
        candidate_name=candidate.name,
        test_date=certificate.test_date,
        track=track,
        score_tier=score_tier,
        overall_score=report.overall_score or 0,
        categories=candidate.categories,
    )

    certificate.pdf_data = pdf_bytes
    certificate.pdf_filename = f"KOS_Certificate_{cert_id}.pdf"

    db.add(certificate)
    await db.commit()
    await db.refresh(certificate)

    return CertificateResponse(
        id=certificate.id,
        report_id=certificate.report_id,
        certificate_id=certificate.certificate_id,
        candidate_name=certificate.candidate_name,
        test_date=certificate.test_date,
        track=certificate.track,
        score_tier=certificate.score_tier,
        overall_score=certificate.overall_score,
        verification_url=certificate.verification_url,
        created_at=certificate.created_at,
        has_pdf=True
    )


@router.get("/report/{report_id}", response_model=CertificateResponse)
async def get_certificate_by_report(report_id: int, db: AsyncSession = Depends(get_db)):
    """Get certificate for a report."""
    query = select(Certificate).where(Certificate.report_id == report_id)
    result = await db.execute(query)
    certificate = result.scalars().first()

    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")

    return CertificateResponse(
        id=certificate.id,
        report_id=certificate.report_id,
        certificate_id=certificate.certificate_id,
        candidate_name=certificate.candidate_name,
        test_date=certificate.test_date,
        track=certificate.track,
        score_tier=certificate.score_tier,
        overall_score=certificate.overall_score,
        verification_url=certificate.verification_url,
        created_at=certificate.created_at,
        has_pdf=certificate.pdf_data is not None
    )


@router.get("/download/{report_id}")
async def download_certificate(report_id: int, db: AsyncSession = Depends(get_db)):
    """Download certificate PDF."""
    query = select(Certificate).where(Certificate.report_id == report_id)
    result = await db.execute(query)
    certificate = result.scalars().first()

    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")

    if not certificate.pdf_data:
        raise HTTPException(status_code=404, detail="Certificate PDF not generated")

    return Response(
        content=certificate.pdf_data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={certificate.pdf_filename or 'certificate.pdf'}"
        }
    )


@router.get("/verify/{certificate_id}", response_model=CertificateVerification)
async def verify_certificate(certificate_id: str, db: AsyncSession = Depends(get_db)):
    """Verify a certificate by its ID (public endpoint)."""
    query = select(Certificate).where(Certificate.certificate_id == certificate_id)
    result = await db.execute(query)
    certificate = result.scalars().first()

    if not certificate:
        return CertificateVerification(
            valid=False,
            certificate_id=certificate_id,
            message="Certificate not found. This certificate ID is invalid or does not exist."
        )

    return CertificateVerification(
        valid=True,
        certificate_id=certificate.certificate_id,
        candidate_name=certificate.candidate_name,
        test_date=certificate.test_date,
        track=certificate.track,
        score_tier=certificate.score_tier,
        overall_score=certificate.overall_score,
        message="This certificate is valid and was issued by KOS (Kernel of Science)."
    )


@router.get("", response_model=List[CertificateResponse])
async def list_certificates(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List all certificates (admin)."""
    query = (
        select(Certificate)
        .offset(skip)
        .limit(limit)
        .order_by(Certificate.created_at.desc())
    )
    result = await db.execute(query)
    certificates = result.scalars().all()

    return [
        CertificateResponse(
            id=cert.id,
            report_id=cert.report_id,
            certificate_id=cert.certificate_id,
            candidate_name=cert.candidate_name,
            test_date=cert.test_date,
            track=cert.track,
            score_tier=cert.score_tier,
            overall_score=cert.overall_score,
            verification_url=cert.verification_url,
            created_at=cert.created_at,
            has_pdf=cert.pdf_data is not None
        )
        for cert in certificates
    ]
