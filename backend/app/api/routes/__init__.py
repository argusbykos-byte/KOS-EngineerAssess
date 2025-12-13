from fastapi import APIRouter
from app.api.routes import candidates, tests, questions, answers, reports, challenges, feedback, code, certificates

api_router = APIRouter()

api_router.include_router(candidates.router, prefix="/candidates", tags=["candidates"])
api_router.include_router(tests.router, prefix="/tests", tags=["tests"])
api_router.include_router(questions.router, prefix="/questions", tags=["questions"])
api_router.include_router(answers.router, prefix="/answers", tags=["answers"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(certificates.router, prefix="/certificates", tags=["certificates"])
api_router.include_router(challenges.router, prefix="/challenges", tags=["challenges"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(code.router, prefix="/code", tags=["code"])
