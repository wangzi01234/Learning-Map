"""应用 Alembic 迁移（供应用启动或 CLI 调用）。"""
from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config


def run_upgrade_head() -> None:
    """执行 `alembic upgrade head`，与 `alembic.ini` 同目录下工作。"""
    backend_root = Path(__file__).resolve().parents[2]
    alembic_ini = backend_root / "alembic.ini"
    if not alembic_ini.is_file():
        raise FileNotFoundError(f"未找到 Alembic 配置：{alembic_ini}")

    cfg = Config(str(alembic_ini))
    # 无论从哪个工作目录启动，脚本路径都指向 backend/alembic
    cfg.set_main_option("script_location", str(backend_root / "alembic"))
    command.upgrade(cfg, "head")
