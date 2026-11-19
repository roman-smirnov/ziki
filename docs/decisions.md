# Ziki decisions

## 2026-11-16 · Accepted · Independent React and Babylon project

The single HTML file combines Three.js, UI, and one straight-line puzzle. We considered copying that arrangement, using pre-rendered backdrops, or building a reusable Babylon scene. The standalone Vite project uses React for the lesson UI and Babylon for the fixed camera and render loop. The original HTML was kept separately as the baseline. The app runs without a Dabi checkout. The npm lock pins aligned Babylon packages. Real Chrome and GLB evidence is in [verification](verification.md). See [Babylon’s React integration](https://doc.babylonjs.com/communityExtensions/Babylon.js%2BExternalLibraries/BabylonJS_and_ReactJS/) and [React’s effect cleanup reference](https://react.dev/reference/react/useEffect).

## 2026-11-16 · Accepted · Simulation owns the rules

Interpolating positions directly as commands run would make world motion responsible for battery, sensors and error handling. Instead, [the planner](../src/game/plan.ts) evaluates code against a fresh fixture and makes an ordered event list; the view animates a straight flight for each move command and commits its state at every tile crossing. A view reset cancels the playhead. Resize affects framing, not simulation. Backgrounding pauses the playhead, and context loss resets the run and permits a fresh scene on the same canvas. The scene uses an orthographic camera with registered extents; its graph and DOM labels are released on a fixture change. Unit cases and browser checks cover determinism, resize, reset and lifecycle.

## 2026-11-16 · Accepted · Cardinal board and integer charge ledger

The old mission measures straight-line meters. In the core curriculum each cardinal crossing costs one meter and has a whole-tile arrival. Front-left is (0, 0). North increases logical `y`, rendered as world `z`. The ledger counts integer charge units, with one million per meter. A range read floors the charge to whole crossings. Derived percentage and displayed percentage are separate fields. Tests cover edge stopping, exact arrival, fractional charge and both percentage readings. A future diagonal flight mode requires its own rule and decision before it can ship.

## 2026-11-16 · Accepted · Bounded C# subset

We chose the prototype’s allowlisted interpreter over bringing a .NET compiler to the browser. Expressions and commands needed in the lessons are preserved, with source spans and level-specific APIs. Runtime checks are deliberately narrower than the C# compiler and the unsupported features are listed in the README. [Microsoft’s rounding reference](https://learn.microsoft.com/en-us/dotnet/api/system.math.round?view=net-10.0) defines the two rounding overloads. The optional local .NET program and the unit tests use the same checked expression fixtures, including midpoint rounding, truncation and exceptional results.

## 2026-11-16 · Historical · Nine lessons with transfer setups

A single static puzzle gives little evidence that the same code works with new values. The data-driven sequence starts with east and west, then range prediction. Level 4 leads into the independent GPS challenge and the remaining Math methods. A teacher can jump to any lesson. Session drafts follow the lesson across setup changes, and primary and transfer completion are tracked separately. Unit and browser tests exercise both setups where present. The teacher and learner dry run is open.

## 2026-11-16 · Accepted for release candidate · Compact original garden art

The assets use a reusable hand-built GLB and a procedural garden kit. Version 1.0.1 restores the prototype’s continuous meadow, picket fence, flower beds, taller trees, and glass greenhouse panels. The camera keeps the HUD clear and preserves the board’s readable north and east axes. This keeps the clear screen face from the prototype and scales to wider beds. Repeated scenery is merged by material; the soil PNG carries fine detail and the directional light casts shadows from the drone and scenery. The camera and HUD retain contrast and use muted surroundings to emphasize the active features. Browser captures are available at 1280 × 720 and 1024 × 768; formal palette approval and the classroom projector review are open. See [Babylon’s glTF export guidance](https://doc.babylonjs.com/preparingArtForBabylon/dccToGltf) and [asset attribution](attribution.md).

## 2026-11-16 · Accepted · Static offline package

We considered distributing the old single HTML, hosting a service, and building a static folder. The selected `dist/` folder contains code, models, textures, fonts and notices. Once installed and built, teaching needs only loopback HTTP and a browser. The browser suite rejects non-loopback requests during the first flight. No accounts, remote storage or persistent drafts are needed.

## 2026-11-17 · Signed offsets for classroom movement

The opening lessons use `Move(int tiles)` to teach horizontal motion from a signed integer. The GPS lesson introduces `Move(int x, int y)` for relative offsets, with x crossings before y and one meter of charge per crossing. Game methods use PascalCase. Student code needs only integers to select a route.

## 2026-11-18 · Thirteen lessons with one setup each

Each lesson has a single starting setup, an independent draft, and a completion checkmark for the page session. The sequence adds early variable and subtraction lessons and gives the two battery-range cases their own levels. The [teacher guide](teacher.md) follows the current order.
