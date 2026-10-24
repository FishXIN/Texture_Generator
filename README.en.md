# Texture Generator

A local texture studio for designers. Generate seamless monochrome paper grain, speckles, grunge, fibers and cracks for Multiply overlays, transparent compositing and grayscale masks. Normal maps are optional. The main workspace shows the texture directly in 2D.

[简体中文](README.md#简体中文) · [Product plan](docs/product-plan.md) · [Capability coverage](docs/texture-coverage.md) · [Roadmap](docs/roadmap.md) · [Development](docs/development.md) · [Changelog](CHANGELOG.md) · [Published installers](https://github.com/FishXIN/Texture_Generator/releases)

**Main contains the 0.5.0 source. Existing release installers retain their older capabilities; check the attached version.**

![Monochrome texture studio](docs/images/texture-studio.png)

## Monochrome textures

- 119 editable presets across 11 searchable visual groups, with unified continuous fields, graphic particles, input grayscale/Alpha and animation.
- Twelve layouts: random, grid, stagger, cluster, spaced, blue noise, gradient, radial, editable/SVG path, mirror, kaleidoscope and manual dragging.
- Independent particle size, grayscale and Alpha ranges; weighted SVG input mixing and persistent manual outline seeds.
- Thirteen periodic motions including RK4 curl flow, vortex, wave, flicker, grow, morph, parallax, snow refresh and evolution.
- Ten advanced algorithms: Value, Perlin, torus Simplex, Worley, uniform, Gaussian, salt-and-pepper, Poisson counts, Blue Noise and random Gabor kernels.
- Xuan, mulberry, cotton, watercolor, laid, recycled, kraft, aged and crumpled paper; white/black marble and ink marbling.
- Halftone dots, variable dots, comic hatching, spectral interference and contours; glow, bokeh, mist and satin patterns.
- Periodic noise, ridged noise, cellular patterns and smooth seeded dots with shared height/gradient calculations.
- Layer visibility, locks, duplication, ordering, blending, contrast, brightness, inversion and domain warp, with dedicated fiber density, vein width, dot coverage, edge softness and light-radius controls.
- Unit and 3 × 3 tiled preview; checkerboard, light and dark backgrounds for transparent output.
- Local PNG / JPEG / WebP / SVG grayscale sources, original-source retention and optional periodic edge blending.
- Project save/reopen, undo/redo and local recovery.
- Worker rendering with progress, cancellation and retry; identical seeds and UV positions retain their composition at different resolutions.

| Output | Usage |
| --- | --- |
| Grayscale PNG, 8 / 16 bit | Multiply overlay in a design app, grayscale mask or non-color height data |
| Black transparent PNG, 8 / 16 bit | Black pigment with alpha = 1 − grayscale; ordinary compositing |
| White transparent PNG, 8 / 16 bit | White pigment with alpha = grayscale; light overlays |
| Optional normal PNG, RGB 8 bit | Tangent-space directions, OpenGL +Y or DirectX −Y; import as non-color data |
| Paired ZIP | Texture, normal and an output manifest |
| Pure / optimized SVG | Actual graphic paths and reusable structures; incompatible effects are rejected |
| Effects SVG | Explicitly embeds PNG to retain continuous effects |
| PNG sequence ZIP | Looping frames, optional Alpha / normals and timing manifest |

The default is an 8-bit grayscale PNG with normal output disabled. Export sizes are 128–4096 px; preview is 512 px. True 16-bit samples are encoded directly from floating-point values, without an 8-bit Canvas intermediate. Soft-light presets also support Screen/Soft Light blending or white transparent overlays. Preview backgrounds and tile guides are excluded. Older projects receive defaults for the new controls.

![Additional texture families](docs/images/texture-families.png)

Paper and stone presets are procedural style simulations, not physical scans.

Limits: eight layers, four imported sources, 2000 ordinary particles per layer, 512 blue/spaced samples, 5 MB per source and 25 MB per project. Imported sources retain separate grayscale and Alpha at up to 1024 px. Height layers composite transparency onto middle gray, while graphics/printing use the original Alpha. Periodic blending changes the input. Sequence exports are limited to 128 million total pixels. Static preview is 512 px; animation is 192 px.

No colored material channels, 3D viewport, node editor or model baking is included. See [implementation and boundaries](docs/material-studio.md).

## Graphic and motion workspace

Open the lower-left link or `?studio=pattern` for the existing 0.2.0 workflow. Opening an older `.texture.json` routes to this workspace.

- Circles, ellipses, short lines and fragments with independent density, size, color and opacity.
- Multiple layers with visibility, locking, duplication, ordering and blend modes.
- Safe SVG import, manual placement and dragging, transforms, recoloring, weighted automatic scattering.
- Random, grid, staggered and clustered layouts; spacing, directional gradients and jitter.
- Separate seeded random streams and parameter locks; regeneration preserves manual objects.
- Periodic edge copies and neighbor-aware spacing, unit editing and 3 × 3 tiled preview.
- Rectangle, ellipse and SVG alpha masks, including exclusion regions.
- Drift, wandering, directional flow, rotation and breathing loops; playback and time scrubbing.
- Project files, embedded original assets, undo / redo, local recovery and parameter presets.
- Checkerboard, light, dark and custom preview backgrounds; tile boundaries and zoom.

Import, rendering and export run locally. The original raster/base-image workflow remains accessible through the top-bar **底图阵列** button.

## Exports

| Format | Output |
| --- | --- |
| PNG | Current frame, optional full Alpha transparency |
| JPEG | Current frame with the chosen canvas background |
| Pure SVG | Editable vector structure; rejects raster images, fonts and filters |
| Effects SVG | Sanitized SVG effects, with explicit compatibility notices |
| Optimized SVG | Reuses custom vector structures through definitions and references |
| PNG sequence ZIP | Transparent looping frames plus a timing and import manifest |

Choose the canvas, a selection, a seamless unit or a filled pattern. Export checks report size, object count, transparency and loop state. Generation supports progress, cancellation and retry.

SVG source files are retained. Scripts and external references are removed; unsupported elements and complex styles are reported. Text should be outlined before import. Blend modes, fonts and filters still require verification in the target design software.

Seamless drift uses eight snapped directions and integer tile journeys; duration and cycle count control speed without reseeding the layout. Spacing is conservative and constraints can reduce the resulting count. Continuous monochrome noise and editable paths are available in the main workspace. This older workspace does not have path layouts. Transparent video, PDF and animated SVG remain future work.

Limits: 64–4096 px canvas, 16 layers, 32 SVG assets, 20,000 generated particles and 2,000 manual objects. SVG inputs are limited to 5 MB each and projects to 25 MB. Static raster export supports up to 16 MP / 8192 px; sequences support 4 MP per frame, 720 frames and a 256 MB ZIP. Large or complex SVGs can still be expensive to render.

## Run locally

Use Node.js 20 / 22 and npm 10+.

```bash
git clone https://github.com/FishXIN/Texture_Generator.git
cd Texture_Generator
npm ci
npm run dev:web
```

```bash
npm run dev                       # Electron studio
npm run typecheck
npm run build
npx playwright install chromium
npm test
npm run dist:mac                  # On Windows: npm run dist:win
```

Twenty-seven Playwright scenarios cover all 119 presets, algorithm statistics and gradients, blue-noise spectral suppression, periodic space and time, input Alpha, SVG pixel agreement, true 16-bit PNG, manual dragging, undo, old-project defaults and the existing graphics/motion workflow.

Project architecture: `src/app` routes the workspaces; `features/material` owns monochrome fields, Worker generation, PNG encoding and the 2D editor; `project`, `assets`, `texture` and `export` retain the graphics/motion workflow. See [architecture](docs/architecture.md) and [contributing](CONTRIBUTING.md).

[MIT](LICENSE)
