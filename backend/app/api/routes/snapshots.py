from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models import GraphSnapshot, LearningCase
from app.schemas.graph import GraphSnapshotCreate, GraphSnapshotListItem, GraphSnapshotOut

router = APIRouter(prefix="/api/graph/snapshots", tags=["snapshots"])


def _iso(dt: datetime | None) -> str:
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


@router.post("", response_model=GraphSnapshotOut)
def create_snapshot(body: GraphSnapshotCreate, db: Session = Depends(get_db)) -> GraphSnapshotOut:
    case = db.execute(
        select(LearningCase).where(LearningCase.slug == body.case_slug)
    ).scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail=f"未找到学习案例：{body.case_slug}")
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name 不能为空。")

    row = GraphSnapshot(
        case_id=case.id,
        name=name,
        nodes_json=body.nodes,
        edges_json=body.edges,
        todos_json=body.todos,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return GraphSnapshotOut(
        id=str(row.id),
        case_slug=case.slug,
        name=row.name,
        nodes=row.nodes_json,
        edges=row.edges_json,
        todos=row.todos_json,
        created_at=_iso(row.created_at),
        updated_at=_iso(row.updated_at),
    )


@router.get("", response_model=list[GraphSnapshotListItem])
def list_snapshots(
    case_slug: str | None = None,
    db: Session = Depends(get_db),
) -> list[GraphSnapshotListItem]:
    q = select(GraphSnapshot, LearningCase.slug).join(
        LearningCase, GraphSnapshot.case_id == LearningCase.id
    )
    if case_slug:
        q = q.where(LearningCase.slug == case_slug)
    q = q.order_by(GraphSnapshot.updated_at.desc())
    rows = db.execute(q).all()
    out: list[GraphSnapshotListItem] = []
    for snap, slug in rows:
        out.append(
            GraphSnapshotListItem(
                id=str(snap.id),
                case_slug=slug,
                name=snap.name,
                created_at=_iso(snap.created_at),
                updated_at=_iso(snap.updated_at),
            )
        )
    return out


@router.get("/{snapshot_id}", response_model=GraphSnapshotOut)
def get_snapshot(snapshot_id: str, db: Session = Depends(get_db)) -> GraphSnapshotOut:
    import uuid

    try:
        uid = uuid.UUID(snapshot_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="无效的 snapshot id") from e

    row = db.execute(select(GraphSnapshot).where(GraphSnapshot.id == uid)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="未找到快照")
    case = db.execute(select(LearningCase).where(LearningCase.id == row.case_id)).scalar_one()
    return GraphSnapshotOut(
        id=str(row.id),
        case_slug=case.slug,
        name=row.name,
        nodes=row.nodes_json,
        edges=row.edges_json,
        todos=row.todos_json,
        created_at=_iso(row.created_at),
        updated_at=_iso(row.updated_at),
    )
