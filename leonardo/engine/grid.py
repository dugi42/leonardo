"""Structured parametric grid and index-based triangulation.

Vertices are row-major: index = i * nv + j, where i runs along the first
parameter (u) and j along the second (v). A wrapping axis omits its endpoint so
the seam is closed by index modulo instead of duplicated vertices.
"""

from __future__ import annotations

import numpy as np


def make_grid(
    nu: int,
    nv: int,
    u_range: tuple[float, float],
    v_range: tuple[float, float],
    wrap_u: bool,
    wrap_v: bool,
) -> tuple[np.ndarray, np.ndarray]:
    u = np.linspace(u_range[0], u_range[1], nu, endpoint=not wrap_u)
    v = np.linspace(v_range[0], v_range[1], nv, endpoint=not wrap_v)
    uu, vv = np.meshgrid(u, v, indexing="ij")
    return uu.ravel(), vv.ravel()


def grid_faces(nu: int, nv: int, wrap_u: bool, wrap_v: bool) -> np.ndarray:
    """Two triangles per grid quad, consistent winding, seams closed by modulo."""
    ni = nu if wrap_u else nu - 1
    nj = nv if wrap_v else nv - 1
    i = np.arange(ni)[:, None]
    j = np.arange(nj)[None, :]
    i1 = (i + 1) % nu
    j1 = (j + 1) % nv
    a = np.broadcast_to(i * nv + j, (ni, nj)).ravel()
    b = np.broadcast_to(i1 * nv + j, (ni, nj)).ravel()
    c = np.broadcast_to(i1 * nv + j1, (ni, nj)).ravel()
    d = np.broadcast_to(i * nv + j1, (ni, nj)).ravel()
    return np.vstack([np.column_stack([a, b, c]), np.column_stack([a, c, d])]).astype(np.int64)


def cap_faces(nu: int, nv: int, start_center: int, end_center: int) -> np.ndarray:
    """Fan-close both open ends of a grid built with wrap_u=False, wrap_v=True."""
    j = np.arange(nv)
    j1 = (j + 1) % nv
    start_ring = j  # i = 0
    end_ring = (nu - 1) * nv + j
    end_ring1 = (nu - 1) * nv + j1
    start = np.column_stack([np.full(nv, start_center), start_ring, j1])
    end = np.column_stack([np.full(nv, end_center), end_ring1, end_ring])
    return np.vstack([start, end]).astype(np.int64)
