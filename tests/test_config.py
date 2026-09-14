import pytest

from leonardo.config import Config, ConfigError, load_config


def test_loads_repo_config(config_path):
    cfg = load_config(config_path)
    assert isinstance(cfg, Config)
    assert set(cfg.models) == {"csym", "rsym"}
    assert cfg.models["csym"].parameters["radius"] == (30.0, 50.0)
    assert cfg.models["csym"].parameters["num_points"] == 250
    assert cfg.print.target_height_mm == 100.0
    assert cfg.app["preview_points"] == 120


def test_range_must_be_min_max(tmp_path):
    p = tmp_path / "c.yml"
    p.write_text(
        "models:\n  csym:\n    num_texture_types: 4\n    parameters:\n      radius: [50, 30]\n"
        "print: {target_height_mm: 100, min_radius_mm: 1}\napp: {}\n"
    )
    with pytest.raises(ConfigError, match=r"models\.csym\.parameters\.radius"):
        load_config(p)


def test_missing_section(tmp_path):
    p = tmp_path / "c.yml"
    p.write_text("models: {}\napp: {}\n")
    with pytest.raises(ConfigError, match="print"):
        load_config(p)
