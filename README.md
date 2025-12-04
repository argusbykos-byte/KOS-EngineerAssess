# KOS-EngineerAssess

AI-powered engineering candidate assessment platform.

## Project Structure

```
KOS-EngineerAssess/
├── frontend/          # Next.js 14 with TypeScript, Tailwind, shadcn/ui
├── backend/           # FastAPI Python server
└── README.md
```

## Features

- **Admin Dashboard**: Upload resumes, configure tests, view candidates and scores
- **Candidate Test Interface**: Timed assessments with multiple sections
- **AI Integration**: Resume analysis, question generation, answer evaluation
- **Categories**: Backend, ML, Full-stack, Python, React, Signal Processing

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## AI Integration

Connects to Kimi2 LLM at `http://localhost:8080/v1/chat/completions`
