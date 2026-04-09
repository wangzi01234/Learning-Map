"""
Learning Map 后端入口：开发时使用 `uvicorn main:app --reload --host 127.0.0.1 --port 3131`。
"""

import logging

from app.app import create_app

logging.basicConfig(level=logging.INFO)

app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=3131, reload=True)
