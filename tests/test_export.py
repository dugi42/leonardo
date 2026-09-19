import trimesh

from leonardo.config import load_config
from leonardo.engine import export, export_bytes, generate


def test_export_writes_both_formats(tmp_path, config_path):
    d = generate(load_config(config_path), 42, "rsym", num_points=40)
    paths = export(d, tmp_path)
    assert sorted(p.name for p in paths) == ["42_rsym.3mf", "42_rsym.stl"]
    ref = d.to_trimesh().volume
    for p in paths:
        m = trimesh.load(p, force="mesh")
        assert m.is_watertight
        assert abs(m.volume - ref) / ref < 1e-3


def test_export_bytes_3mf_is_zip(config_path):
    d = generate(load_config(config_path), 1, "csym", num_points=30)
    assert export_bytes(d, "3mf")[:2] == b"PK"
