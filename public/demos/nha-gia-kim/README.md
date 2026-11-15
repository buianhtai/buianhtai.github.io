# Nhà giả kim — browser prototype

Interactive 90-second six-scene **Canvas animatic** inspired by the *visual language* of Lemo-Opuscar's HD-2D example. This is **not** a Three.js/Lemo-Opuscar render.

## Watch

- Site: https://buianhtai.github.io/demos/nha-gia-kim/
- Source player: [index.html](./index.html) — self-contained, no external dependencies.
- GitHub Pages repository: https://github.com/buianhtai/buianhtai.github.io

## Controls

Press Play/Pause, click a scene card to jump, seek using the progress bar, choose VI/EN subtitles, and toggle optional browser-generated voice and ambient sound. Space toggles playback and arrow keys seek. On mobile devices, narration/audio need an explicit user gesture.

## Verified behavior

- Browser smoke-tested in headless Chromium at 1440 × 960 and 390 × 844.
- 6 scenes, player controls, subtitle language changes, seek, responsive layout, no JavaScript exceptions in test.
- Independently exported MP4 is 90.027s at 1280 × 720 and 24 fps, H.264/AAC; **the MP4 is not hosted in this repository**.

## Known limitations

This is procedural 2D Canvas, not physical 3D. Art, character expression, camera motion, audio mix, and recorded Vietnamese narration are placeholders for a production pass. Browsers may not have Vietnamese TTS voices installed.

## For Codex / future production

1. Use this self-contained index.html as the timing and interaction reference.
2. Port shot geometry and characters to Three.js using the Lemo-Opuscar `styles/hd-2d` design language; do not copy the sample film's original characters or assets.
3. Build reusable scenes, character rigs/sprites, shaders, lighting, real camera motion, and particles.
4. Add properly licensed Vietnamese voice recording and SFX, adjust timing based on voice durations, then render and QA.
5. Separate the player into a reusable app and connect render jobs to a production pipeline.

## Rights

*The Alchemist* is a copyrighted work. This is a noncommercial proof-of-concept with newly written narration; review and obtain the required adaptation rights before any public distribution of a finished film.
