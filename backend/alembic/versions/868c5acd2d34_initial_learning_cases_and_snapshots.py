"""initial_learning_cases_and_snapshots

Revision ID: 868c5acd2d34
Revises:
Create Date: 2026-04-08 17:08:22.519123

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "868c5acd2d34"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "learning_cases",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("subtitle", sa.String(length=512), server_default="", nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("initial_nodes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("initial_edges", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_learning_cases_slug"), "learning_cases", ["slug"], unique=True)

    op.create_table(
        "graph_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("nodes_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("edges_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("todos_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["case_id"], ["learning_cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_graph_snapshots_case_id"), "graph_snapshots", ["case_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_graph_snapshots_case_id"), table_name="graph_snapshots")
    op.drop_table("graph_snapshots")
    op.drop_index(op.f("ix_learning_cases_slug"), table_name="learning_cases")
    op.drop_table("learning_cases")
