import os
from pathlib import Path

import pytest

os.environ.setdefault("LEONARDO_SKIP_SERVER", "1")

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def config_path() -> Path:
    return ROOT / "config.yml"
