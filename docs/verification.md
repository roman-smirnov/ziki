# Verification history

## Ziki’s Garden 1.0.1 classroom release

These results and screenshots describe the November 16 classroom build. The lesson sequence and interface have since changed. Run the checks in the [README](../README.md#verify-and-maintain) to verify the current build.

Verified 2026-11-16 on macOS 27.2.1 with Node 26.8.1, npm 11.19.0, .NET SDK 10.0.403, Playwright 1.63.0, and headless Google Chrome 157.0.8103.78 using WebGL and the Apple M5 ANGLE Metal renderer.

- Production `dist/index.html` SHA-256: `906e9d54dc8b0070f9eadc299829e320f052096070a091edaa226dfcd99e9007`. A fresh source copy produced the same entry file.
- `Zikis-Garden-classroom-1.0.1.zip` SHA-256: `1c5df4476c5170e6a0b5c63b00a79116e68b1f1f9f6f93568eb7cb74a2e87208`. ZIP integrity passed. Contains the static game, instructions, teacher guide and runtime notices.
- Production cold navigation to ready: **458 ms** (first visit in a fresh browser context; includes model and scene readiness, and the test's readiness polling). Two one-second samples during the GPS route: **60.0 and 60.0 FPS**. These are reference results on this Mac; they do not measure the classroom laptop or projector.
- The historical prototype smoke check was rerun. It passed for the two straight-line routes, range, the six Math methods, reset, projected labels and offline assets. The core game deliberately uses cardinal flight and has its own fixtures.

| Verification | Result |
| --- | --- |
| V01 · Build | Fresh `npm ci --offline --no-audit --no-fund` from the npm cache, `npm run typecheck`, 17 unit tests, and `npm run build` passed. Chrome completed the opening flights with requests outside its loopback origin blocked; no external requests were attempted. |
| V02 · First flights | Passed on production Chrome using starter, edit, keyboard launch, harvest, Next level, and the first battery HUD. |
| V03 · Cardinal rules | Unit cases cover four headings, no-op, out-of-bounds, exhaustion, fractional charge and exact arrival. Browser reset interrupts animation, returns to the dock and restores charge, keeping the draft. |
| V04 · Abs and Round | Both guarded predictions, unguarded failure, fresh raw percentages, two rounded percentages and unchanged range passed. Active command capture below. Optional .NET oracle passed 18 expression cases and 3 overflow checks. |
| V05 · GPS transfer | Both fixtures passed. Recorded HUD transitions through each cardinal tile, including (5, 0) before the first north crossing. Verified separate raw pin, wrong starter tile, fractional argument diagnostic, and both remaining ranges. |
| V06 · Remaining lessons | All four passed in Chrome. Unit tests also cover both alternate fixtures where defined, and short and excess loads and range settings. |
| V07 · Editor and lifecycle | Passed seven total Playwright journeys, covering keyboard, drafts, restore starter, rapid run/reset, ten switches on one engine, fullscreen, visibility pause/resume, mute, reduced motion/effects, WebGL unavailable, and actual simulated context loss/restoration with run cancellation. |
| V08 · Real rendering | Chrome and viewport review complete with the captures below. Repeat on the intended classroom browser if it differs. |
| V09 · Classroom projection | **Pending.** On the classroom laptop and projector, check startup, motion, full-room readability, sound audibility, silent operation, and separation of the GPS pin from Ziki’s position. |
| V10 · Lesson comprehension | **Pending.** Rehearse with teacher and learner; record predictions, explanations and any confusing cues. |
| V11 · Handoff | Fresh install, separate Chrome profiles and ZIP integrity checked. Extracted the ZIP into a clean folder, served it with the documented Python command, and completed the production Chrome opening-flight smoke test with external requests blocked. |

The graphics review used the same 1280 × 720 Chrome viewport for the original HTML and both Babylon builds. The original is the earlier 16 × 10 straight-line puzzle. The two Babylon captures both show the same six-tile opening lesson.

- [Original standalone HTML](verification/original-1280x720.png)
- [Opening lesson before the graphics update](verification/01-before-visual-refresh.png)
- [Opening lesson after the graphics update](verification/01-first-harvest-1280x720.png)

## Implementation checklist evidence

| Items | Owner or evidence |
| --- | --- |
| I01 | [Project manifest](../package.json), lockfile and verified production build. The standalone prototype was retained separately. |
| I02 | [Opening frame, 1280 × 720](verification/01-first-harvest-1280x720.png) and [Level 3 battery frame](verification/03-battery-1280x720.png). Reviewed locally for framing, palette and contrast; teacher approval and projected review pending. |
| I03–I04 | [Parser](../src/code/parser.ts), [evaluator](../src/code/evaluator.ts), [planner](../src/game/plan.ts), [engine-independent tests](../tests/game.test.mjs). |
| I05 | [Playback](../src/game/playback.ts), [scene owner](../src/scene/renderer.ts) and lifecycle cases in the [browser suite](../e2e/garden.spec.mjs). |
| I06–I09 | [Level fixtures](../src/levels/index.ts) and both test suites. [Rounding with the line active](verification/04-rounding-active-line.png), [GPS at 1024 × 768](verification/05-gps-1024x768.png), and [filled transfer tray](verification/08-tray-1280x720.png). |
| I10 | [Ziki and soil assets](../public/assets/), [garden kit](../src/scene/garden.ts), [audio](../src/game/audio.ts), [attribution](attribution.md). Machine tests cover controls and playback. In-room audio review is pending. |
| I11 | [App and editor](../src/ui/), [GPS on a narrow screen](verification/05-gps-mobile.png), and the keyboard, fullscreen, resize and WebGL fallback browser tests. |
| I12 | [Offline instructions](../README.md#teach-without-internet), the classroom ZIP, and reference machine measurements above. |
