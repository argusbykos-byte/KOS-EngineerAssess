import os
import aiofiles
from typing import Optional
from PyPDF2 import PdfReader
from docx import Document
from io import BytesIO
from app.config import settings


class ResumeService:
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        os.makedirs(self.upload_dir, exist_ok=True)

    async def save_resume(self, file_content: bytes, filename: str, candidate_id: int) -> str:
        """Save uploaded resume file and return the path."""
        # Create candidate directory
        candidate_dir = os.path.join(self.upload_dir, str(candidate_id))
        os.makedirs(candidate_dir, exist_ok=True)

        # Save file
        file_path = os.path.join(candidate_dir, filename)
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_content)

        return file_path

    def extract_text_from_pdf(self, file_content: bytes) -> str:
        """Extract text from PDF file."""
        try:
            reader = PdfReader(BytesIO(file_content))
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            print(f"Error extracting PDF text: {e}")
            return ""

    def extract_text_from_docx(self, file_content: bytes) -> str:
        """Extract text from DOCX file."""
        try:
            doc = Document(BytesIO(file_content))
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text.strip()
        except Exception as e:
            print(f"Error extracting DOCX text: {e}")
            return ""

    def extract_text(self, file_content: bytes, filename: str) -> str:
        """Extract text from resume file based on extension."""
        ext = os.path.splitext(filename)[1].lower()

        if ext == '.pdf':
            return self.extract_text_from_pdf(file_content)
        elif ext in ['.docx', '.doc']:
            return self.extract_text_from_docx(file_content)
        elif ext == '.txt':
            return file_content.decode('utf-8', errors='ignore')
        else:
            return ""

    async def get_resume_text(self, file_path: str) -> str:
        """Read and extract text from saved resume file."""
        try:
            async with aiofiles.open(file_path, 'rb') as f:
                content = await f.read()
            return self.extract_text(content, file_path)
        except Exception as e:
            print(f"Error reading resume: {e}")
            return ""


# Singleton instance
resume_service = ResumeService()
