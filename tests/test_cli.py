from leonardo.cli import main


def test_generate_count_writes_files(tmp_path, config_path):
    rc = main(["--config", str(config_path), "generate", "--seed", "10", "--count", "3",
               "--out", str(tmp_path), "--points", "30"])
    assert rc == 0
    files = sorted(p.name for p in tmp_path.iterdir())
    assert len(files) == 6
    assert all(f.split("_")[0] in {"10", "11", "12"} for f in files)


def test_generate_single_format(tmp_path, config_path):
    rc = main(["--config", str(config_path), "generate", "--seed", "1", "--out", str(tmp_path),
               "--format", "stl", "--points", "30", "--model", "csym"])
    assert rc == 0
    assert [p.name for p in tmp_path.iterdir()] == ["1_csym.stl"]


def test_bad_model_exits_nonzero(tmp_path, config_path):
    rc = main(["--config", str(config_path), "generate", "--model", "nope", "--out", str(tmp_path)])
    assert rc != 0


def test_bad_format_exits_nonzero(tmp_path, config_path):
    rc = main(["--config", str(config_path), "generate", "--format", "obj", "--out", str(tmp_path)])
    assert rc == 2


def test_bad_config_exits_2(tmp_path):
    bad = tmp_path / "c.yml"
    bad.write_text("models: {}\n")
    assert main(["--config", str(bad), "generate", "--out", str(tmp_path)]) == 2
