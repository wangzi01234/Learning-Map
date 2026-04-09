import json
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import LearningCase

logger = logging.getLogger(__name__)

_SEED_DIR = Path(__file__).resolve().parent.parent / "seed"


def _load_demo_graph() -> tuple[list, list]:
    path = _SEED_DIR / "demo_graph.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw["initial_nodes"], raw["initial_edges"]


def seed_learning_cases_if_empty(db: Session) -> None:
    existing = db.execute(select(LearningCase.id).limit(1)).scalar_one_or_none()
    if existing is not None:
        return

    nodes, edges = _load_demo_graph()
    db.add(
        LearningCase(
            slug="builtin-demo",
            title="示例知识脉络",
            subtitle="示例 · 可替换为你的学习主题",
            description=(
                "内置演示案例：展示节点卡片、连线与扩展能力。"
                "可将节点与边替换为任意学科或项目下的概念结构。"
            ),
            initial_nodes=nodes,
            initial_edges=edges,
            sort_order=0,
        )
    )
    db.add(
        LearningCase(
            slug="open-topic",
            title="开放主题学习",
            subtitle="自选领域 · 通用知识脉络",
            description=(
                "不限定具体学科。根据用户请求，在任意学习主题下补充概念节点、关系与待办。"
                "保持概念准确、结构清晰；category 与 relation 标签应贴合该主题。"
            ),
            initial_nodes=[],
            initial_edges=[],
            sort_order=10,
        )
    )
    db.commit()
    logger.info("已写入内置学习案例（learning_cases）。")
