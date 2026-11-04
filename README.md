# webGL3D

Small WebGL experiments with [three.js](https://threejs.org), no build step.

| Path | What |
|---|---|
| [`/fishing/`](fishing/) | **Lakeside Fishing**: cast, hook and reel in five fish species. Sounds are synthesized with the Web Audio API. Add `?preview` to see all fish up close. |
| [`/`](index.html) | First scene: lit shapes with shadows, orbit controls, click to recolor. |

Live: https://vancuongngo.github.io/webGL3D/fishing/

## Run locally

ES modules don't load from `file://`, so serve the folder:

    python3 -m http.server 8000

Then open http://localhost:8000/fishing/
