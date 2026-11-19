# Edge-to-edge garden redesign

## Target layout

On wide screens, the garden fills the browser viewport. The page header, outer gutters, and rounded stage border disappear. The dark coding workspace floats at the upper right. A small dark control group sits at the lower left of the garden, with a visible **Sound off** or **Sound on** label and a fullscreen icon. The browser tab displays **Ziki**.

On narrow screens, the garden spans the full width at the top and the editor follows below it in the page. The controls stay in the lower-left corner of the garden and scroll with it. Use the current 1100 px layout breakpoint as a starting point. Review both sides of the breakpoint and try 1024 × 768 in fullscreen before settling on it. If that size is used in the classroom, prefer side by side there only if the 10 × 10 board and the code are both readable.

## Implementation

### 1. Make the garden the page

- In [`App.tsx`](../src/ui/App.tsx) and [`styles.css`](../src/styles.css), remove the visible header and the stage’s width cap, padding, border, and clipping. Keep the document title in [`index.html`](../index.html) and retain an accessible page name with a visually hidden heading.
- On desktop, keep the garden and workspace in the same grid row. Make the garden sticky at the top and size it to the viewport height. Let the workspace remain in page flow so long programs can grow and scroll while the garden stays visible. On narrow screens, switch to two rows and size the garden to leave room for the start of the editor on a typical phone. Let the page scroll vertically when needed.
- Start with the existing desktop console width and adjust it after reviewing the board and code together. Keep Run Sequence, Reset Garden, feedback, and lesson/setup selection in their current places within the console. Preserve the editor’s growth, keyboard shortcuts, and draft behavior. When Run is triggered after the garden has scrolled out of view on a narrow screen, bring the garden back into view so the flight can be seen. Running from the desktop editor should leave the scroll position alone while the sticky garden is visible.

### 2. Move sound and fullscreen into the garden

- Move the existing buttons and handlers into a group named **Display controls** inside the garden’s layout. Use the console’s dark palette and space the controls away from the viewport edges and device safe areas. Keep the sound state visible at phone widths, the pressed state exposed to assistive technology, and both buttons easy to reach by keyboard and touch.
- Keep the app-wide fullscreen target so the garden, editor, and buttons all remain available. Preserve capability detection, the **Fullscreen** / **Exit fullscreen** accessible names and tooltip, and synchronization through `fullscreenchange`, including exit with Escape. Keep sound off on startup. Show a brief message by the controls if a fullscreen request fails, where it can be seen even when the editor is farther down the page.

### 3. Fit the board into the space left by the controls

- In [`GardenView.tsx`](../src/ui/GardenView.tsx) and [`styles.css`](../src/styles.css), give `.scene-focus` responsive insets derived from the same layout values as the workspace and bottom controls. On desktop, end the focus area before the console. On narrow screens, use the garden’s width. Leave room below the board for the display controls and the tray/delivery readout so they can share the lower band without covering each other.
- Reuse `Renderer.resize()` in [`renderer.ts`](../src/scene/renderer.ts). It already observes the canvas and focus area and fits the orthographic camera to the playable bounds. Keep the WebGL canvas the full size of the garden and keep projected labels in canvas coordinates. Adjust the playable bounds or padding only if a board edge, drone, axis number, or gameplay label gets clipped in review. Check resize and fullscreen while a run is in progress. Layout changes should reframe the existing scene and preserve flight progress.
- Verify the loading message, flat-map fallback, and victory effect all fit the same open area. Keep the existing pixel-density cap and compare motion on the larger canvas against the current layout on the same machine.

## Verification

| Case | What to check |
| --- | --- |
| 1280 × 720 and 1920 × 1080 | The canvas meets all four viewport edges, the page header is gone, and the controls sit inside the lower-left corner. The code workspace and playable area stay visible together while scrolling through a long program. |
| 1024 × 768 and around the breakpoint | The selected layout keeps the board and code usable, and resizing across the breakpoint preserves the draft and active run. |
| 390 × 844 and a short landscape viewport | The editor follows the garden, the labels and controls fit without horizontal page scrolling, and Run returns the view to the garden when needed. |
| First Harvest, the 11-tile battery strip, GPS, and the seed tray | Ziki, both axes, tile numbers, and lesson markers stay inside the open area. The GPS pin and tray counts are clear of the console and utility buttons. |
| Fullscreen, sound, and WebGL fallback | Enter and exit fullscreen from the button and with Escape. Verify mute, focus order, the unsupported fullscreen case, and a successful flight on the flat map. |

Update the layout assertions in [`garden.spec.mjs`](../e2e/garden.spec.mjs) that currently expect a visible heading and a canvas below it. Extend the existing viewport, long-program, and fullscreen checks with geometry assertions and keep the current keyboard, GPS, audio, resize, and renderer lifecycle coverage. Capture the opening lesson and GPS on desktop, and the garden with the editor below on mobile. Run `npm test`, `npm run build`, and `npm run test:e2e`, then check tile numbers and code from the back of the room on the classroom projector. Update the layout and fullscreen descriptions in the README after the layout is implemented.
