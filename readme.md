# Parity Avatars

Generative avatars for Parity staff as unique NFTs that evolve with their careers.

![Demo screenshot](./snap/vo-0.png)

## Temporary Demo

See the temporary live demo on the [separate GitHub Pages site](https://epok.tech/wip-project-demo-1/).

This is hosted from a public repository, which contains no obvious references to the project specifics and only the compiled code of this project; this can be done from this repository as follows (but ensure there's no sensitive information in any `.env` in the root folder first!):

```bash
yarn dist:fresh && rm -rf path/to/wip-project-demo-1/* && cp -R dist/* path/to/wip-project-demo-1/
```

## Inputs via URL Queries

All the main inputs are passed in as query-string parameters (e.g: `demo.com?key-0=value-0&key-1=value-1`).

### Main Inputs

- `id`:
  The `string` ID of the avatar distinguishes its assets in the bucket/folder.
Default is `id`.
- `seed`:
  A random seed `integer`, for deterministic random number generation.
- `pause-on-blur`:
  Flag `boolean` to pause rendering when the page is blurred. Default is `true`.
- `shadows`:
  The `number` level of quality of shadows, `0` to `4`. Default is `4`.

### Initial State

- `pause`:
  Flag `boolean` to start the app in a paused state. Default is `false`.
- `animate`:
  Flag `boolean` to animate or update instantly. Default is `true`.

### Screenshots and File Persistence

- `screenshots`:
  Flag `boolean` to capture screenshots automatically. Default is `false`.
- `screenshot-at-0`, `screenshot-at-1`, `screenshot-at-2`, `screenshot-at-3`:
  Camera `number` positions to capture screenshots from, up to 4 denoted
  `screenshot-at-0` to `screenshot-at-3`.

  3 `number` values per position, 1 per-axis, like
  `screenshot-at-0=0&screenshot-at-0=1&screenshot-at-0=2`.

  To disable a position and screenshot, pass any non-`number` value.
  Default is 4 valid camera positions.
- `upload`:
  Flag `boolean` to upload screenshots to `S3`, or local download otherwise.

  Requires a `.env` file at the project root with valid values for:
  - `AWS_BUCKET_NAME`
  - `AWS_REGION`
  - `AWS_ACCESS_SECRET`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_PATH`
  - `AWS_URL`

  Default is `false`.

### Post-Process Effects

- `fxaa`:
  Flag `boolean` to use the anti-aliasing post-process. Default is `true`.
- `ssao`:
  Flag `boolean` to use the screen-space-ambient-occlusion post-process.
  Default is `true`.
- `dof`:
  Flag `boolean` to use the depth-of-field post-process. Default is `true`.
- `bloom`:
  Flag `boolean` to use the emissive-bloom post-process. Default is `true`.
- `fog`:
  Flag `boolean` to use the fog post-process. Default is `true`.
- `fog-color`:
  The fog CSS color `string`, like `#09f` (may need `URL`-encoding).
  Default is `#1e1e1e`.

### Distorted Body Effects

- `distort-orient`:
  Distorted body flag `boolean` to calculate surface normals. Default is `true`.
- `distort-cell`:
  Distorted body flag `boolean` or `number` value to use cell-noise, and if so
  which type.

  Given as `false` (uses classic noise); or a `number` (cell-noise type):
  - `0`: nearest cell.
  - `1`: next-nearest cell.
  - Any other `number`: Voronoi cell (`1-0`, true boundary).

  Default is `2`, for Voronoi cell-noise.
- `distort-noise`:
  Distorted body noise input `number` scaling values per-axis.
  3 values, like `distort-noise=0&distort-noise=1&distort-noise=2`.
  Default is `4`, `4`, `4` for `x`, `y`, `z` scales.
- `distort-speed`:
  Distorted body noise input `number` velocity values, per-axis.
  3 values, like `distort-speed=0&distort-speed=1&distort-speed=2`.
- `distort-jitter`:
  Distorted body cell-noise `number` jitter amount.
  No jitter at `0` gives a linear grid; full jitter at `1` gives organic cells.
  Default is `1`.
- `distort-surface`:
  Distorted body distortion `number` amounts.
  4 values, like
  `distort-surface=0&distort-surface=1&distort-surface=2&distort-surface=3`.

  Each entry denotes a different setting:
  1. Amount the initial surface expands (`+`) or shrinks (`-`).
  2. Amount to distort the surface normal.
  3. Amount the distorted surface expands (`+`) or shrinks (`-`).
  4. Threshold to make the distorted surface transparent (`+`) or opaque (`-`).
- `distort-metal`:
  Distorted body metallic `number` value for physically-based-rendering.
- `distort-rough`:
  Distorted body roughness `number` value for physically-based-rendering.
- `distort-gaps`:
  Distorted body threshold `number` to give the distorted surface transparent
  gaps.
- `distort-cull`:
  Distorted body `string` value of which polygon faces to cull (hide), any of:
  - `none`/`None`: cull (hide) no faces, show all.
  - `front`/`Front`: cull (hide) front-faces.
  - `back`/`Back`: cull (hide) back-faces.
  - `both`/`Both`/`front-and-back`/`FrontAndBack`: cull (hide) all faces.

  Default is `front`.
- `distort`:
  Distorted body flag `boolean` to render the distorted body.
  Default is `true`.

### Shapes in a Volume

- `volume-ramp`:
  Volume `number` taper ramp values, 4 values as 2 pairs:
  - Values `0`-`1`: start-end ramp of distance from the volume surface.
  - Values `2`-`3`: start-end ramp of equivalent scaling of shapes in volume.

  If animating, the ramp distance from the volume surface will animate in from
  `0` to the end value.

  Default is `0`-`0.03` (ramp distance from the volume surface) and `0.15`-`1`
  (equivalent scaling of shapes in volume).
- `volume-clamp`:
  Distance `number` value to move shapes lying outside the volume back towards
  the volume, relative to how far they lie outside it.
  Controls how the shapes are clamped within the volume.
  Default is `1.5`.
- `shape-color`:
  Shape CSS color `string` range, like `#09f` (may need `URL`-encoding).
  The 2 colors that are mixed between by the shape's color-noise field, and
  applied to each shape.
  2 values, like `shape-color=red&shape-color=blue`.
  Default is `#d17521` and `#0d1ec7`.
- `shape-color-noise`:
  Shape color noise input `number` scaling values per-axis.

  4 values, like
  `shape-color-noise=0&shape-color-noise=1&shape-color-noise=2&shape-color-noise=3`.

  Default is `5`, `5`, `5` for `x`, `y`, `z` scales; and `0.0003` time-scale.
- `shape-metal`:
  Shape metallic `number` value for physically-based-rendering.
- `shape-rough`:
  Shape roughness `number` value for physically-based-rendering.
- `shape-scale`:
  Shape scale `number` value range, a start-end scale range the shapes vary
  over according to their position relative to the volume.
  2 values, like `shape-scale=0&shape-scale=1`.
  Default is `0.02` start scale, `0.05` end scale.
- `shape`:
  Shape geometry `string` names to use when generating shapes.
  Any number of values, like `shape=cube-f&shape=cone-g` and any others.
  Default is `cube-f`, `tetrahedron-f`.

### Scatter Shapes

- `scatter`:
  Scatter `number` of shape instances randomly before growing the L-system.
  Default is `600`.
- `scatter-offsets`:
  Scatter flag `boolean` to use offset instances. Default is `true`.
- `scatter-rotates`:
  Scatter flag `boolean` to use rotate instances.
  Leave disabled to better see shapes align to the volume surface.
  Default is `false`.
- `scatter-scales`:
  Scatter flag `boolean` to use scale instances. Default is `true`.

### Scatter to Grow

- `scatter-grow`:
  Flag `boolean` to grow an L-system at each scattered point, or use it as a
  single separate processes otherwise.

  Caution! Can be costly at high settings or inputs, and is combinatorially
  explosive with scatter and grow amounts.

  Default is `true`.

### Grow L-System

- `grow-steps`:
  Grow L-system `number` of steps to iterate. Default is `2`.
- `grow-offsets`:
  Grow L-system flag `boolean` to use offset instances. Default is `true`.
- `grow-rotates`:
  Grow L-system flag `boolean` to use rotate instances.
  Leave disabled to better see shapes align to the volume surface.
  Default is `false`.
- `grow-scales`:
  Grow L-system flag `boolean` to use scale instances. Default is `true`.
- `grow-offset`:
  Grow L-system `number` offset position to start growing from.

  3 `number` values, 1 per-axis, like
  `grow-offset=0&grow-offset=1&grow-offset=2`.

  Ignored if `scatter-grow` is `true`, as scattered instances are used instead.
  Default is `-0.01`, `0.2`, `0` (in the middle of the bust's head).
- `grow-rotate`:
  Grow L-system `number` rotation to start growing from.

  4 `number` values, as a quaternion rotation, like
  `grow-rotate=0&grow-rotate=1&grow-rotate=2&grow-rotate=3`.

  Ignored if `scatter-grow` is `true`, as scattered instances are used instead.
  Default is a `y`-axis rotation (rotated to face out from the bust's head).
- `grow-scale`:
  Grow L-system `number` scale to start growing from.
  1 `number` value, uniform across all axes, like `grow-scale=1`.
  Ignored if `scatter-grow` is `true`, as scattered instances are used instead.
  Default is halfway between the `shape-scale` range.
- `grow-length`:
  Grow L-system `number` length to advance offset at each growth step.
  Default is `0.03`.
- `grow-angle`:
  Grow L-system `number` angle to rotate by at each growth step.
  This value is multiplied by `pi` to convert it to an angle.
  Default is `0.25`, giving a 45 degree angle.
- `grow-length-rate`:
  Grow L-system `number` length rate to change the `grow-length` by rules.
  The rate of change, used to either multiply or divide the step amount.
  Default is `1.2`, giving a 20% increase or decrease any time a rule uses it.
- `grow-scale-rate`:
  Grow L-system `number` scale rate to change the `grow-scale` by rules.
  The rate of change, used to either multiply or divide the step amount.
  Default is `1.2`, giving a 20% increase or decrease any time a rule uses it.
- `grow-angle-rate`:
  Grow L-system `number` angle rate to change the `grow-angle` by rules.
  Default is `1.2`, giving a 20% increase or decrease any time a rule uses it.

- Full L-system grow-rules:
  L-system grow axiom and rules.
  Original set, based on the Houdini syntax: `FHGfhJKMT+-&^\/|*~"!;_?@[]<>`.
  URL aliases, substitutions for URL-encodings: `FHGfhJKMT -$^\/|*~"!;_.@[]<>`.

  Each rule is a character that's mapped to an instruction, and can be replaced
  by new character by iterating the L-system growth:
  - `F`: Move forward, creating geometry.
  - `H`: Move forward half the length, creating geometry.
  - `G`: Move forward but don't record a vertex.
  - `f`: Move forward, no geometry created.
  - `h`: Move forward a half length, no geometry created.
  - `J`: Copy geometry from leaf `J` at the turtle's position.
  - `K`: Copy geometry from leaf `K` at the turtle's position.
  - `M`: Copy geometry from leaf `M` at the turtle's position.
  - `T`: Apply tropism vector (gravity).
  - `+` (URL alias ` `): Turn right by angle.
  - `-`: Turn left by angle.
  - `&` (URL alias `$`): Pitch down by angle.
  - `^`: Pitch up by angle.
  - `\\`: Roll clockwise by angle.
  - `/`: Roll counter-clockwise by angle.
  - `|`: Turn back.
  - `*`: Roll over.
  - `~`: Pitch/roll/turn random amount up to angle.
  - `"`: Multiply current length by step size scale.
  - `!`: Multiply current width by thickness scale.
  - `;`: Multiply current angle by angle scale.
  - `_`: Divide current length by step size scale.
  - `?` (URL alias `.`): Divide current width by thickness scale.
  - `@`: Divide current angle by angle scale.
  - `[`: Push turtle state (start a branch).
  - `]`: Pop turtle state (end a branch).
  - `<`: Check left context.
  - `>`: Check right context.

  See:
  - [3D interactive demo](https://github.com/nylki/lindenmayer/blob/main/docs/examples/interactive_lsystem_builder/index_3d.html).
  - [Houdini L-system syntax](https://www.sidefx.com/docs/houdini/nodes/sop/lsystem.html).
  - [Houdini L-system recipes](https://www.houdinikitchen.net/2019/12/21/how-to-create-l-systems/).
- `grow-axiom`:
  Grow L-system `string` axiom rule, to start the L-system growth to be
  replaced according to the `grow-rules`.
  Default is `^^A`.

  See: Full L-system grow-rules for their meaning.
- `grow-rule`:
  Grow L-system `string` production rules, to iterate the L-system growth by
  replacing the `grow-axiom`, with the term/s on the left of a `->` (or `=`)
  replaced by the term/s to the right.
  Any number of values, like `grow-rule=A->FA&grow-rule=F->AF` and any others.
  Default is `A->M[F"![^A&&A]-A++A]`, growing a simple concentric form.

  See: Full L-system grow-rules for their meaning.

### Eyes

- `eye-scale`:
  Eye `number` scale, uniform across all axes. Default is `0.03`.
- `eye-intense`:
  Eye `number` intensity of light emitted. Default is `0.2`.
- `eye-alpha`:
  Eye `number` alpha transparency. Default is `0.6`.
- `eye-color`:
  Eye CSS color `string`, like `#09f` (may need `URL`-encoding).
  Color of the eye shape and the light it emits.
  Default is `#fff` (white).
- `eye-emit`:
  Eye `number` emissive color, scales `eye-color`. Default is `2`.
- `eye-l`, `eye-r`:
  Eye `number` positions, up to 2 denoted `eye-l` and `eye-r`.

  3 `number` values per position, 1 per-axis, like
  `eye-l=0&eye-l=1&eye-l=2` and `eye-r=3&eye-r=4&eye-r=5`.

  To disable an eye, pass any non-`number` value.
  Default is 2 valid eye positions.

### Lights

- `lit-at-0`, `lit-at-1`, `lit-at-2`, `lit-at-3`:
  Lights `number` positions, up to 4 denoted `lit-at-0` to `lit-at-3`.

  3 `number` values per position, 1 per-axis, like
  `lit-at-0=0&lit-at-0=1&lit-at-0=2`.

  To disable a light, pass any non-`number` value.
  Default is 4 valid light positions.
- `lit-color-0`, `lit-color-1`, `lit-color-2`, `lit-color-3`:
  Lights CSS color `string` values, like `#09f` (may need `URL`-encoding), up
  to 4 denoted `lit-color-0` to `lit-color-3`, like
  `lit-color-0=red&lit-color-1=blue&lit-color-2=green&lit-color-3=white`.
  To disable a light, pass a value resulting in black.
  Default is 4 light colors.
