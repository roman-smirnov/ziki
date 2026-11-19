# Asset attribution

| Item | Provenance |
| --- | --- |
| Ziki and rotors | Original procedural model in [make_ziki.py](../art/make_ziki.py), exported as `public/assets/ziki.glb` with Blender. Blue/orange silhouette and screen face refer to the workspace prototype. |
| Soil | Original deterministic grain and pebble texture baked with [make_soil.py](../art/make_soil.py). |
| Buildings, border flowers, garden, map pins, and interface icons | Created in the project’s TypeScript/TSX without external models or imagery. |
| Harvest rose | Adapted from [Low Poly Rose by Yratz](https://sketchfab.com/3d-models/low-poly-rose-7af507370e564d86a5ebe0a4728c2f19), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The stem was shortened and the petals were reshaped and recolored before export as [rose.glb](../public/assets/rose.glb). See the [credit included in the static build](../public/ASSET_CREDITS.txt). |
| Audio | Flight cues synthesized in [audio.ts](../src/game/audio.ts), with takeoff and harvest notes adapted from the prototype. Victory cheers and applause copied from Dabi’s `public/assets/audio/sfx/celebration/applause/applause-01.wav` into [applause-01.wav](../public/assets/audio/applause-01.wav). Dabi’s source metadata records ElevenLabs `eleven_text_to_sound_v2` generation on 2026-10-04. |
| Victory celebration | Confetti fountain motion, curling streamers, and radial fireworks adapted from Dabi’s `src/effects` in [celebration.ts](../src/ui/celebration.ts). The locally synthesized victory chime plays alongside Dabi’s applause recording. |
| Nunito and JetBrains Mono | Bundled Latin subsets from their Fontsource packages, under the SIL Open Font License 1.1. The files are served locally. |
| React and scheduler | MIT; package notices included in the production build. |
| Babylon.js core and glTF loader | Apache 2.0; core notice and both package licenses included in the production build. |
| Legacy prototype | The standalone prototype used Three.js r128 under the MIT license. The current website uses Babylon.js. |

The build writes `dist/THIRD_PARTY_NOTICES.txt` from the installed packages.

To rebuild original art, run `blender -b --python-exit-code 1 --python art/make_ziki.py` (the release model was exported with Blender 3.4), and `python3 art/make_soil.py`. Authoring scripts and design references are outside the static build.
