from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models import LearningCase
from app.schemas.graph import LearningCaseDetailOut, LearningCaseOut

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.get("", response_model=list[LearningCaseOut])
def list_cases(db: Session = Depends(get_db)) -> list[LearningCaseOut]:
    rows = db.execute(select(LearningCase).order_by(LearningCase.sort_order, LearningCase.title)).scalars().all()
    return [
        LearningCaseOut(
            id=str(r.id),
            slug=r.slug,
            title=r.title,
            subtitle=r.subtitle,
            description=r.description,
            sort_order=r.sort_order,
        )
        for r in rows
    ]


@router.get("/{slug}", response_model=LearningCaseDetailOut)
def get_case(slug: str, db: Session = Depends(get_db)) -> LearningCaseDetailOut:
    row = db.execute(select(LearningCase).where(LearningCase.slug == slug)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail=f"未找到案例：{slug}")
    return LearningCaseDetailOut(
        id=str(row.id),
        slug=row.slug,
        title=row.title,
        subtitle=row.subtitle,
        description=row.description,
        sort_order=row.sort_order,
        initial_nodes=list(row.initial_nodes or []),
        initial_edges=list(row.initial_edges or []),
    )
