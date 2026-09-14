"""Command line entry point: `leonardo generate` and `leonardo serve`."""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

import numpy as np

from leonardo.config import ConfigError, load_config
from leonardo.engine import FORMATS, MODELS, MeshError, export, generate

log = logging.getLogger("leonardo")


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="leonardo", description="Leonardo generative design engine")
    p.add_argument(
        "--config",
        default=os.environ.get("LEONARDO_CONFIG", "config.yml"),
        help="path to config.yml (env LEONARDO_CONFIG)",
    )
    sub = p.add_subparsers(dest="command", required=True)

    g = sub.add_parser("generate", help="generate designs and write STL/3MF files")
    g.add_argument("--seed", type=int, default=None, help="first seed; random when omitted")
    g.add_argument("--count", type=int, default=1, help="number of consecutive seeds")
    g.add_argument("--model", default="random", choices=["random", *sorted(MODELS)])
    g.add_argument(
        "--out",
        default=os.environ.get("LEONARDO_OUT", "output"),
        help="output directory (env LEONARDO_OUT)",
    )
    g.add_argument("--format", default=",".join(FORMATS), help="comma list of: " + ",".join(FORMATS))
    g.add_argument("--points", type=int, default=None, help="override num_points")

    s = sub.add_parser("serve", help="run the web UI (development server)")
    s.add_argument("--host", default=None)
    s.add_argument("--port", type=int, default=None)
    return p


def _generate(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    formats = [f.strip() for f in args.format.split(",") if f.strip()]
    for f in formats:
        if f not in FORMATS:
            log.error("unknown format %r; choose from %s", f, ",".join(FORMATS))
            return 2
    first = args.seed if args.seed is not None else int(np.random.default_rng().integers(2**31))
    failed = 0
    for seed in range(first, first + args.count):
        try:
            design = generate(config, seed, args.model, num_points=args.points)
        except MeshError as err:
            log.warning("skipped: %s", err)
            failed += 1
            continue
        for path in export(design, Path(args.out), formats):
            print(f"{design.seed}\t{design.model}\t{path}")
    return 1 if failed else 0


def _serve(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    from leonardo.web.app import create_app

    app = create_app(config)
    app.run(
        host=args.host or config.app.get("host", "0.0.0.0"),
        port=args.port or int(config.app.get("port", 8000)),
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        args = _parser().parse_args(argv)
    except SystemExit as e:
        return int(e.code or 0)
    try:
        return _generate(args) if args.command == "generate" else _serve(args)
    except ConfigError as err:
        log.error("config: %s", err)
        return 2


if __name__ == "__main__":
    sys.exit(main())
