# Ziki

A flight lab for a Grade 10 C# class. Students write short programs, watch Ziki cross the garden tile by tile, and use math to solve thirteen missions. This app uses React, TypeScript, Vite, and Babylon.js, with local assets and no external runtime services.

## Start the game

With Node 22.18+ in the Node 22 series, or Node 24+, run these commands from this directory:

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. For a classroom rehearsal, use the built version:

```sh
npm run build
npm run preview -- --host 127.0.0.1
```

The browser needs WebGL for the 3D view. The game also has an interactive flat map if WebGL is disabled or the model cannot load. Use the fullscreen button at the garden’s lower left to project the whole lab. The sound toggle beside it starts off on a first visit and remembers your choice in the browser. The device’s reduced-motion preference removes extra motion such as tilting, hovering and spinning rotors. Ziki still flies along each route so students can follow the move.

### Teach without internet

Install and build before going offline. Serve the existing `dist/` folder over loopback; Vite preview still works with the installed dependencies and no internet connection. Or copy just `dist/` to a classroom laptop with Python 3 and run this beside it:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

On Windows with the Python launcher, use `py -m http.server 4173 --bind 127.0.0.1 --directory dist`. Open `http://127.0.0.1:4173`. Keep the server window open while playing. The page needs an HTTP server to load the browser modules and GLB.

## Fly a sequence

```csharp
Move(3);
```

The front-left tile is `(0, 0)`. East increases `x` and north increases `y`. Each crossing travels 1 m. Each mission has its own garden and starting tile. The GPS level also shows a separate pin at its raw fractional coordinates.

Press **Run Sequence** or **Ctrl/Cmd + Enter**. Each run starts again at the starting tile with fresh variables, roses, and charge. **Reset Garden** cancels playback and resets the board while keeping your code. **Restore starter** replaces that lesson’s draft. Use **Lesson** to jump to any level or **Next level** to continue after a successful run. Each lesson has its own draft and completion checkmark for the current page session.

## Lesson order

| # | Mission | Teaching goal |
| --- | --- | --- |
| 1 | First Harvest | Count east crossings and harvest. |
| 2 | Fly West | Use a negative offset to decrease x. |
| 3 | Follow the Rose Position | Pass the supplied `int` variable to `Move`. |
| 4 | Calculate the Move | Subtract Ziki’s position from the rose’s position to get the eastward offset. |
| 5 | Calculate the Move West | Use the same subtraction when the offset is negative. |
| 6 | Choose a Reachable Rose | Compare travel distances with battery range and choose between two roses. |
| 7 | Reach a Rose on the Last Meter | Handle a route that costs exactly the remaining battery range. |
| 8 | Program the Battery Display | Demonstrate `Math.Round` on a dashboard reading that rounds up. |
| 9 | Find the GPS Rose | Round and cast both fractional GPS coordinates before moving. |
| 10 | One Charge, Two Roses | Use `Math.Min` to choose the cheaper cardinal route. |
| 11 | Charge for Either Rose | Use `Math.Max` to allocate the smallest range that covers either target. |
| 12 | Fill a Square Seed Tray | Use `Math.Pow` to calculate the seed count. |
| 13 | Find the End of the Row | Use `Math.Sqrt` to recover a square’s width. |

The first five missions introduce movement and variables. In Levels 4 and 5, students apply the same subtraction to destinations east and west of Ziki. Levels 6 and 7 give students the battery range and positions for two different decisions. Demonstrate the raw and rounded readings in Level 8, then hand off Level 9 as the student challenge. The [teacher guide](docs/teacher.md) includes complete solutions and teaching prompts.

On screens at least 1024 CSS pixels wide, the garden fills the viewport and the editor floats at the upper right, with the playable board framed to its left. Run, Reset, lesson selection, and feedback share the dark console. The garden stays visible while scrolling through a longer program. On narrower screens, the garden spans the page above the console. Running a program brings the garden back into view if you’ve scrolled down to edit. The editor grows with the program, and Tab and Shift+Tab control indentation.

## Supported C# subset

The browser parses student text and evaluates a lesson-specific allowlist of C# expressions and commands.

- Use initialized `int`, `double`, `float`, `bool`, `string`, and `var` variables, assignments, blocks, `if`/`else`, comments, string literals, numeric casts, and parenthesized expressions.
- Arithmetic includes `+`, `-`, `*`, `/`, and `%` with 32-bit integer arithmetic and integer division toward zero. Conditions support comparisons, equality, `!`, `&&`, and `||`. The interpreter checks types when it evaluates a statement. It does not implement the compiler’s static checks of unexecuted code, constant-expression rules, or the full numeric overload set.
- `Math.Abs`, `Math.Min`, and `Math.Max` return a value in the supported numeric type. `Math.Pow`, `Math.Sqrt`, and `Math.Round` return a `double`. `Math.Round(value)` and `Math.Round(value, digits)` use midpoint-to-even; digits is an `int` from 0 to 15. Nonfinite arithmetic results can be printed; integer casts that cannot represent the result report an error. Commands validate their numeric inputs.
- In the two battery-range lessons, the supplied `batteryRange` variable gives the starting range in meters. Students use the supplied positions to calculate distances and choose a rose. In Level 7, only Rose 2 is reachable and arriving there uses the last meter.
- `Move(int tiles)` moves horizontally. A positive offset goes right, a negative offset goes left, and zero leaves the position unchanged.
- The GPS lesson introduces the overload `Move(int x, int y)`. Both offsets are relative to Ziki’s current tile. Ziki changes x first, then y. Positive y goes toward the back of the garden and negative y goes toward the front. A complete move travels `Math.Abs(x) + Math.Abs(y)` meters. From (2, 3), `Move(3, -2)` ends at (5, 1).
- In rose collection lessons, Ziki picks up the rose automatically if the program finishes on its tile.
- The first five levels have unlimited range. With a battery, a completed crossing costs 1 m. Running into a board edge or trying to cross without enough charge stops the sequence. Ziki can still harvest immediately after spending the last meter.
- `UpdateBatteryPercentage(value)` submits a finite number from 0 through 100 to the display and leaves the range alone. The `batteryPercentage` sensor always reads the underlying charge.
- `SetBatteryRange(meters)` sets the departure range at the starting tile (0–9 m) in **Charge for Either Rose**. `LoadSeeds(count)` replaces the dispenser load and `PlantBed()` puts one seed in each available slot until it runs out. Counts use nonnegative `int` values. Sensors are read-only and reflect earlier commands in the same sequence.

Diagnostics identify the line and column. The interpreter limits the program to 8,000 characters, bounded nesting and tokens, and 256 completed tile crossings per run. Loops, user-defined methods, .NET libraries outside the stated subset, and diagonal flight are outside the core game.

## Verify and maintain

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The browser tests use an installed copy of Google Chrome and start a local server for the production build. With the .NET 10 SDK installed, run `npm run test:oracle` to check the interpreter's numeric fixtures against .NET.

The production build writes the static site and third-party notices to `dist/`. See the [architecture decisions](docs/decisions.md), [asset attribution](docs/attribution.md), and [verification history](docs/verification.md).
