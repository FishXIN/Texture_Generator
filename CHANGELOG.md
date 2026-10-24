# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### 0.6.0 Unified minimal workbench

- Combined uploaded backgrounds, original-color PNG/SVG elements and monochrome textures in one layer stack. Applying presets preserves uploaded artwork.
- Added direct background/element upload, batch element mixing, original aspect ratios and full-canvas/material-only export.
- Replaced repeated previews, permanent technical labels and output explanations with a flat neutral workspace and contextual advanced settings.
- Added critically damped sliders, exact numeric input and one-step gesture undo. A persistent preview worker processes the latest parameters continuously during dragging, then restores detailed preview.
- Preserved source RGB/Alpha in RGBA PNG, effects SVG and sequences; pure procedural PNG retains true 8/16-bit gray/Alpha. Original assets are decoded again for exports.
- Added browser checks for repeated canvas updates while the pointer stays pressed, exact release, undo, keyboard, locks, colored/transparent artwork, preset retention, aspect ratio and project/export round trips.

### 0.5.0 Complete monochrome library

- Expanded to 119 presets in 11 visual groups, with unified continuous fields, graphic particles, input grayscale/Alpha and animation.
- Added 12 distributions, editable arc-length paths and SVG contour sampling, radial/mirror/kaleidoscope arrangements, weighted SVG mixing and manual dragging.
- Added independent per-particle size, grayscale and Alpha ranges, persistent manual outline seeds and motion locks.
- Implemented ten distinct noise algorithms with periodic Perlin gradients, 4D torus Simplex, count-based Poisson, spectrally checked best-candidate Blue Noise and random compact Gabor kernels.
- Added film, dust/curved scratches, natural ribbons/rings/waves, painting/printing damage, surface and digital generators; input-driven halftone, Bayer and random dithering.
- Added thirteen periodic motions, curl flow RK4 advection with cached continuous mapping, vortex rotation, flicker, grow/morph and repeating snow seeds.
- Added PNG sequence ZIP, true graphic SVG and reusable SVG, and explicitly raster-embedded effects SVG. Existing 8/16-bit grayscale/Alpha and optional normal outputs remain.
- Added browser acceptance for algorithm statistics/spectra, shared presets, time/UV loops, input Alpha, SVG pixels/straight channels, manual UI editing and compatibility.

### 0.4.0 Texture families

- Expanded from 10 to 31 presets with paper, marble, pop/optical and soft-light families, category filtering and search.
- Added periodic pulp fibers, creases, marble veins, halftone dots, crosshatching, spectral interference, contours, glow and bokeh fields with matching analytic gradients.
- Added dedicated density, coverage, softness, vein and light controls; particle density is separate from opacity/weight.
- Added white transparent light overlays with true 8/16-bit alpha, alongside black transparent textures. Output descriptions distinguish Multiply, Screen and Soft Light use.
- Added old-project defaults for the new controls and pigment choice.
- Added three browser scenarios for every preset's reproducibility/distinctness, control effectiveness, backward compatibility, white PNG data and category/search/light export. All 19 scenarios pass.

### 0.3.0 Monochrome textures

- Added a 2D monochrome texture workspace with ten editable presets, periodic continuous fields, seeded speckles, layer blending and tiled/transparent inspection.
- Added grayscale PNG/JPEG/WebP/SVG source import with original retention, SVG cleaning and optional periodic edge blending.
- Added true 8/16-bit grayscale PNG and black-alpha PNG exports, optional OpenGL/DirectX normals and paired ZIP manifests at up to 4096 px.
- Added Worker rendering and encoding with progress, termination on cancel, retry, project save/reopen and local history.
- Made the main workflow suitable for Multiply overlays, transparent compositing and grayscale masks; normal output is disabled by default. No 3D viewport or Three.js dependency is included.
- Retained the graphic/motion workspace at `?studio=pattern`; opening an older project routes to it.
- Added six browser scenarios for periodic values/gradients, resolution and seed invariance, normal conventions, independent PNG/CRC/16-bit/alpha checks and cancellation recovery. The existing ten scenarios remain.

No 0.3.0 installer release or third-party design software certification is implied by this source change.

### 0.2.0 Studio

- Added a desktop browser/Electron texture studio with an independent canvas, transparent background, graphic particles, multiple layers and editable SVG placement.
- Added random, grid, staggered and clustered layouts, weighted custom shapes, periodic neighbor spacing, rectangular/elliptical/SVG masks and tiled zoom preview.
- Added separate seeded random streams, parameter locks, project files with original assets, local recovery, presets and undo/redo.
- Added periodic drift, wandering, directional flow, rotation and breathing; manual motion locks, playback and arbitrary-frame export.
- Added transparent PNG, JPEG, pure/effects/optimized SVG and transparent PNG sequence ZIP exports with regions, scale, preflight checks, progress, cancellation and timing manifests.
- Added SVG sanitization, scoped IDs, CSS cascade handling, original-source retention and explicit raster/font/filter compatibility notices.
- Retained the original raster/base-image editor under the “底图阵列” entry.
- Added 10 Chromium acceptance scenarios, pixel comparisons, independent ZIP verification and CI browser checks.
- Corrected fractional-scale tile rendering, recolored gradient transparency, missing-mask export checks and oversized SVG aspect-ratio handling.
- Updated the bilingual README, architecture, roadmap and development instructions for the implemented capabilities. Adjusted the macOS window header for traffic-light controls.

No 0.2.0 installer release is implied by this source change.

### Changed

- Reorganized source code into `app`, `features/assets`, `features/texture`, `features/export`, and `shared`, keeping the existing layout and rendering behavior.
- Rewrote the bilingual README around verified capabilities, export limitations, and the proposed product direction.
- Added product planning, roadmap, architecture, development, release, and contribution documentation; archived the initial implementation proposal.
- Updated repository metadata and download links to `FishXIN/Texture_Generator`.
- Clarified SVG export copy: SVG source files can contain raster images, fonts, or filters, so SVG import alone does not certify pure-vector output.
- Moved release documentation out of the build output directory and ignored generated packages, TypeScript caches, and local editor configuration.

### Added

- A `typecheck` command and CI checks for main-branch pushes and pull requests.
- A pull request template; release builds now install the committed dependency lockfile with `npm ci`.

### Fixed

- Fixed file-input reset after asynchronous asset loading by retaining the input element instead of accessing an expired React event target.

## v0.1.5

### Changed

- Updated the Windows installer to use a guided NSIS flow instead of one-click installation, so users can choose a custom install location during setup.

### Fixed

- Fixed the packaged Windows app startup failure caused by the Electron main-process bundle being emitted with ESM syntax and then loaded as CommonJS by Electron.

## v0.1.4

### Changed

- Updated the preview pipeline so parameter adjustments now refresh the canvas immediately instead of waiting for a debounce delay.
- Updated the development server config to allow automatic port fallback when `5173` is already occupied.

### Improved

- Improved interaction feedback while dragging sliders or editing numeric values, making layout tuning feel more direct and responsive.

## v0.1.3

### Added

- Added `元素间距` control:
  positive values prevent overlap between elements, while negative values allow intentional stacking and overlap.
- Added `边缘间距` control:
  negative values allow elements to cross the canvas boundary until roughly half remains visible, `0` keeps elements exactly tangent to the edge, and positive values enforce a safety margin from the edge.
- Added true vector SVG export:
  when the base asset and all element assets are SVG files, the app now exports a real vector SVG by embedding parsed SVG content instead of raster `<image>` snapshots.

### Changed

- Expanded base image import to support `SVG` in addition to raster image formats.
- Updated the export panel so `SVG` becomes disabled when any imported asset is raster-based.
- Added clear availability messaging for vector export, including disabled-state hover hints and inline status copy.

### Fixed

- Kept export behavior consistent with asset capabilities:
  mixed SVG and bitmap asset sets now correctly fall back to raster-only export flows.
