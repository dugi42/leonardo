"""Load and validate config.yml into frozen dataclasses."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


class ConfigError(ValueError):
    """Raised when config.yml is malformed. Message names the offending key path."""


@dataclass(frozen=True)
class ModelConfig:
    num_texture_types: int
    parameters: dict[str, float | tuple[float, float]]


@dataclass(frozen=True)
class PrintConfig:
    target_height_mm: float
    max_footprint_mm: float
    min_radius_mm: float


@dataclass(frozen=True)
class Config:
    models: dict[str, ModelConfig]
    print: PrintConfig
    app: dict[str, Any]


def _number(value: Any, path: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ConfigError(f"{path}: expected a number, got {value!r}")
    return float(value)


def _parameter(value: Any, path: str) -> float | tuple[float, float]:
    if isinstance(value, list):
        if len(value) != 2:
            raise ConfigError(f"{path}: expected [min, max]")
        lo, hi = _number(value[0], path), _number(value[1], path)
        if lo > hi:
            raise ConfigError(f"{path}: expected [min, max] with min <= max, got {value}")
        return (lo, hi)
    return _number(value, path)


def _model(raw: Any, path: str) -> ModelConfig:
    if not isinstance(raw, dict):
        raise ConfigError(f"{path}: expected a mapping")
    if "num_texture_types" not in raw or "parameters" not in raw:
        raise ConfigError(f"{path}: needs num_texture_types and parameters")
    params = raw["parameters"]
    if not isinstance(params, dict):
        raise ConfigError(f"{path}.parameters: expected a mapping")
    return ModelConfig(
        num_texture_types=int(_number(raw["num_texture_types"], f"{path}.num_texture_types")),
        parameters={k: _parameter(v, f"{path}.parameters.{k}") for k, v in params.items()},
    )


def load_config(path: str | Path) -> Config:
    with open(path, encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}
    for key in ("models", "print", "app"):
        if key not in raw or not isinstance(raw[key], dict):
            raise ConfigError(f"{key}: section missing or not a mapping")
    models = {name: _model(m, f"models.{name}") for name, m in raw["models"].items()}
    pr = raw["print"]
    print_cfg = PrintConfig(
        target_height_mm=_number(pr.get("target_height_mm"), "print.target_height_mm"),
        max_footprint_mm=_number(pr.get("max_footprint_mm"), "print.max_footprint_mm"),
        min_radius_mm=_number(pr.get("min_radius_mm"), "print.min_radius_mm"),
    )
    return Config(models=models, print=print_cfg, app=dict(raw["app"]))
