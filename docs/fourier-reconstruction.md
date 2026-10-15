# Rebuilding shapes from their Fourier transform

From the epicycle drawing in the reel, to a curve in space, to a solid vase.

## 1. The idea in one sentence

Any periodic signal can be written as a sum of sines and cosines. If you treat a shape as a periodic signal, its Fourier coefficients *are* the shape, written in a different language, and summing the terms back translates it into geometry again.

## 2. The reel: a closed curve in the plane

Walk once around the outline of the rocket in time `t ∈ [0, 2π)`. That gives two periodic functions, the x- and y-coordinates of the moving point:

```
x(t) = a₀ + Σₖ (aₖ cos kt + bₖ sin kt)
y(t) = c₀ + Σₖ (cₖ cos kt + dₖ sin kt)
```

Each term `aₖ cos kt + bₖ sin kt` is the shadow of a point going round a circle of radius `rₖ = √(aₖ² + bₖ²)` at `k` turns per loop. Stacking the circles tip-to-tip gives the chain of epicycles; the chain for `x` is projected onto a horizontal line, the chain for `y` onto a vertical one, and where the two projections cross is the pen.

Getting the coefficients from a sampled outline `(xⱼ, yⱼ)`, `j = 0 … M−1`, is just the discrete Fourier transform:

```
aₖ = (2/M) Σⱼ xⱼ cos(2πkj/M)
bₖ = (2/M) Σⱼ xⱼ sin(2πkj/M)
```

Low `k` is the overall blob; high `k` is corners and fins. Stopping the sum at `N` terms gives a smooth approximation, with ringing (the Gibbs effect) next to any sharp corner.

## 3. Step one: a curve in three dimensions

Nothing in the argument depended on there being two coordinates. Add a third series,

```
z(t) = e₀ + Σₖ (eₖ cos kt + fₖ sin kt)
```

and you get three epicycle chains instead of two. The height of each chain's tip is one coordinate, and the three heights together place a point in space. The traced path is a closed space curve: a knot, a loop that bends out of the page, or the rocket outline swung into the third dimension.

What this gives you is a **wire**, not a **solid**. A closed curve has one parameter; a surface has two. For a true 3D object the method has to change.

## 4. Step two: a surface, and a two-dimensional transform

A vase is a surface of revolution with some detail added, so describe it as a radius that depends on height and angle:

```
r(h, φ)      h = height along the axis, φ = angle around it
```

- In `φ` the surface is periodic, so use an ordinary Fourier series.
- In `h` it is not periodic (a vase has a top and a bottom), so use a cosine series, which is the same thing after reflecting the profile to make it even.

```
r(h, φ) ≈ Σₖ Σₘ [ Cₖₘ cos mφ + Sₖₘ sin mφ ] · cos(πk h)
```

The coefficients now form a **grid** indexed by two frequencies:

| | low m | high m |
|---|---|---|
| **low k** | overall size and bulge | roundness vs. flutes |
| **high k** | the sharp lip, the foot | fine ridges |

Reconstruction means choosing a rectangle of that grid, `k ≤ K`, `m ≤ M`, and summing. With `M = 0` the vase is perfectly round at every height however large `K` is; with `K = 0` it has the right cross-section but is a uniform tube. Both sliders have to grow for the pot to come back.

That grid is the Fourier transform of the vase. It contains exactly the same information as the surface, so "rebuilding the object from its transform" is literally the inverse sum.

## 5. Why this is more than a party trick

The same inverse sum runs real instruments:

- **MRI** samples the 3D Fourier transform of the body directly ("k-space") and reconstructs with an inverse FFT.
- **CT** measures projections; the Fourier slice theorem turns each projection into one slice through the 3D transform.
- **Crystallography and coherent diffraction imaging** record the *magnitude* of the transform but lose the phase; the object is recovered by iterative phase-retrieval algorithms plus constraints like finite size.
- **Compressed sensing** fills in a sparsely sampled transform using the assumption that the object is simple in some basis.

Truncating the sum is the same in every case: dropping high frequencies blurs the object, keeping too few terms near an edge produces ringing.

## 6. What the two pages do

**Fourier series in 3D** (curve version)
1. Sample a closed space curve at 720 points.
2. Compute 100 Fourier coefficients for each of x, y, z.
3. Animate three epicycle chains; drop the tip heights onto the axes; trace the partial-sum curve as `N` grows from 1 to 100.

**A vase from its Fourier transform** (surface version)
1. Define `r(h, φ)` for a fluted vase with a sharp lip, and `z(h)` for the height map.
2. Compute the 41 × 17 coefficient grid (cosine in `h`, Fourier in `φ`).
3. Rebuild the surface on a 44 × 56 mesh from the chosen rectangle of coefficients, shade it, and draw the grid alongside with the kept rectangle highlighted.

## 7. Where to take it next

- **Spherical harmonics** are the Fourier basis on a sphere, and handle closed blobby shapes (a head, a potato) that are not surfaces of revolution.
- **Full 3D voxel FFT** describes any object, including hollow and disconnected ones, at the cost of a cubic coefficient array.
- **Phase retrieval**: throw away the phases of the vase's coefficients and try to recover the pot from magnitudes alone — the crystallographer's problem in miniature.
