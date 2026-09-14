import numpy as np
import trimesh

from leonardo.engine.grid import cap_faces, grid_faces, make_grid


def test_make_grid_shapes_and_wrap():
    u, v = make_grid(4, 6, (0.0, 1.0), (0.0, 2 * np.pi), wrap_u=False, wrap_v=True)
    assert u.shape == v.shape == (24,)
    assert u[0] == 0.0 and u[-1] == 1.0
    assert v.max() < 2 * np.pi  # wrapped axis omits endpoint
    assert u[7] == u[6] and v[7] != v[6]  # row-major: index = i*nv + j


def test_grid_faces_counts():
    assert grid_faces(4, 6, False, False).shape == (2 * 3 * 5, 3)
    assert grid_faces(4, 6, False, True).shape == (2 * 3 * 6, 3)
    assert grid_faces(4, 6, True, True).shape == (2 * 4 * 6, 3)


def test_torus_topology_is_closed():
    nu, nv = 12, 16
    u, v = make_grid(nu, nv, (0, 2 * np.pi), (0, 2 * np.pi), True, True)
    x = (2 + np.cos(u)) * np.cos(v)
    y = (2 + np.cos(u)) * np.sin(v)
    z = np.sin(u)
    m = trimesh.Trimesh(np.c_[x, y, z], grid_faces(nu, nv, True, True), process=False)
    assert m.is_watertight and m.is_winding_consistent
    assert m.euler_number == 0


def test_capped_cylinder_is_closed():
    nu, nv = 10, 16
    z, phi = make_grid(nu, nv, (0.0, 5.0), (0.0, 2 * np.pi), False, True)
    verts = np.c_[np.cos(phi), np.sin(phi), z]
    verts = np.vstack([verts, [[0, 0, 0.0]], [[0, 0, 5.0]]])
    n = nu * nv
    faces = np.vstack([grid_faces(nu, nv, False, True), cap_faces(nu, nv, n, n + 1)])
    m = trimesh.Trimesh(verts, faces, process=False)
    assert m.is_watertight and m.is_winding_consistent
    assert m.euler_number == 2
    # 16-gon area is 2.6% below pi
    assert abs(abs(m.volume) - np.pi * 5) / (np.pi * 5) < 0.03
