"""Parametric base models. Each returns (vertices (N,3), faces (M,3)) in raw units."""

from __future__ import annotations

from collections.abc import Callable

import numpy as np

from leonardo.config import PrintConfig
from leonardo.engine.grid import cap_faces, grid_faces, make_grid
from leonardo.engine.spline import normalize01, random_spline
from leonardo.engine.texture import texture
from leonardo.engine.transforms import lame, tilt, twist

ModelFn = Callable[[dict, PrintConfig, np.random.Generator], tuple[np.ndarray, np.ndarray]]


def design_csym(p: dict, pc: PrintConfig, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    """Cylindrical model: radius profile along z, textures, Lame edges, twist, tilt, caps."""
    n = int(p["num_points"])
    height, radius = p["height"], p["radius"]
    z, phi = make_grid(n, n, (0.0, height), (0.0, 2 * np.pi), wrap_u=False, wrap_v=True)

    # Radius profile along z: between radius_offset*R and R.
    profile = normalize01(random_spline(z, rng))
    r = radius * (p["radius_offset"] + (1.0 - p["radius_offset"]) * profile)
    r = r * texture(
        phi, p["phi_texture_type"], p["phi_amplitude"], p["phi_frequency"], p["phi_duty_cycle"],
        rng, wrap=True,
    )
    r = r * texture(
        z / height * 2 * np.pi,
        p["z_texture_type"], p["z_amplitude"], p["z_frequency"], p["z_duty_cycle"], rng,
    )
    r = np.maximum(r, pc.min_radius_mm)

    x, y = lame(r, phi, p["edginess"])

    # Cap centres share the transform pipeline so caps stay attached.
    x = np.append(x, [0.0, 0.0])
    y = np.append(y, [0.0, 0.0])
    z = np.append(z, [0.0, height])

    x, y = twist(x, y, z, p["twist"], rng)
    x, y = tilt(x, y, z, p["tilt_x"] * height, p["tilt_y"] * height, rng)

    nverts = n * n
    faces = np.vstack([grid_faces(n, n, False, True), cap_faces(n, n, nverts, nverts + 1)])
    return np.column_stack([x, y, z]), faces


def _radial_texture(
    theta: np.ndarray, phi: np.ndarray, p: dict, rng: np.random.Generator, wrap_theta: bool
) -> np.ndarray:
    """One positive scale factor per vertex: theta texture times phi texture.

    The phi texture fades with sin(theta) on the ellipsoid so all vertices of a pole
    ring agree with the pole itself. A single scalar keeps the surface star-shaped
    (ellipsoid) or the tube star-shaped (torus), so textures never fold the mesh."""
    s_theta = texture(
        theta, p["theta_texture_type"], p["theta_amplitude"], p["theta_frequency"],
        p["theta_duty_cycle"], rng, wrap=wrap_theta,
    )
    s_phi = texture(
        phi, p["phi_texture_type"], p["phi_amplitude"], p["phi_frequency"],
        p["phi_duty_cycle"], rng, wrap=True,
    )
    if not wrap_theta:
        s_phi = 1.0 + np.sin(theta) * (s_phi - 1.0)
    return np.maximum(s_theta * s_phi, 0.1)


def design_rsym(p: dict, pc: PrintConfig, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    """Spherical model: ellipsoid (pole-capped) or torus base, textures, three twists."""
    n = int(p["num_points"])
    torus = bool(rng.integers(2))
    if torus:
        theta, phi = make_grid(n, n, (0.0, 2 * np.pi), (0.0, 2 * np.pi), True, True)
        # Textured tube radius, kept below the ring radius so the tube cannot cross itself.
        tube = np.minimum(p["r_ratio"] * _radial_texture(theta, phi, p, rng, True), 0.95)
        x = (1 + tube * np.cos(theta)) * np.cos(phi)
        y = (1 + tube * np.cos(theta)) * np.sin(phi)
        z = tube * np.sin(theta)
        faces = grid_faces(n, n, True, True)
    else:
        # Interior theta rings only; poles appended as fan centres.
        theta_all = np.linspace(0.0, np.pi, n + 2)
        theta, phi = make_grid(
            n, n, (theta_all[1], theta_all[-2]), (0.0, 2 * np.pi), False, True
        )
        theta = np.append(theta, [0.0, np.pi])
        phi = np.append(phi, [0.0, 0.0])
        s = _radial_texture(theta, phi, p, rng, False)
        x = np.cos(phi) * np.sin(theta) * s
        y = np.sin(phi) * np.sin(theta) * s
        z = np.cos(theta) * s
        faces = np.vstack([grid_faces(n, n, False, True), cap_faces(n, n, n * n, n * n + 1)])

    x, y, z = x * p["x_scaler"], y * p["y_scaler"], z * p["z_scaler"]

    x, y = twist(x, y, z, p["e1_twist"], rng)
    x, z = twist(x, z, y, p["e2_twist"], rng)
    y, z = twist(y, z, x, p["e3_twist"], rng)
    return np.column_stack([x, y, z]), faces


MODELS: dict[str, ModelFn] = {"csym": design_csym, "rsym": design_rsym}
