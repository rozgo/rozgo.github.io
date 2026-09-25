# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal portfolio website hosted on GitHub Pages. It is plain HTML, CSS and JavaScript. There is no package manager, build process, PHP backend, or frontend framework. Pages are edited by hand.

## Commands

### Development
- **Local preview**: `python3 -m http.server 8000`, then open http://localhost:8000/. Links point to folders (`work/veoveo/`), so use the server rather than opening files from disk.
- **Link check**: `python3 scripts/check_links.py --youtube` (checks every `.html` file: local files, anchors across pages, image attributes, `rel=noopener`, and YouTube availability)
- **Deploy**: Push to master branch - GitHub Pages automatically deploys changes

## Structure

| Path | Contents |
| --- | --- |
| `index.html` | Home: hero reel, Systems (`#work`), Research lab (`#lab`), Career (`#career`), Writing (`#writing`), About (`#about`), Contact (`#contact`) |
| `work/<slug>/index.html` | One page per system: veoveo, alienwars-gym, shield-ai-simulator, maquina, axionomy, simbotic |
| `writing/<slug>/index.html` | Articles from the "Simulated Worlds" series, copied from X |
| `archive/index.html` | All portfolio videos, grouped by era, with topic filters |
| `css/main.css` | All styles. Dark only; color and font tokens on `:root` (Geist, Geist Mono) |
| `js/main.js` | Mobile menu, hero reel, hover previews, card tilt, video lightbox, archive filters |
| `js/scene.js` | Live WebGL background (Three.js, vendored in `js/vendor/`): LiDAR-style terrain, drones and rovers with sensor footprints, scan pulse. `body[data-scene="hero"]` on the home page (camera follows scroll), `ambient` elsewhere |
| `media/clips/` | 4-5 s muted MP4 loops (640x360, H.264) with WebP posters, used by the hero reel and lab hover previews |
| `media/thumbs/<youtube-id>.webp` | 640x360 video thumbnails |
| `media/work/` | Project images, each at 1600 px (`name.webp`) and 800 px (`name-800.webp`) |
| `media/writing/` | Article covers (`slug.webp`) and list thumbnails (`slug-thumb.webp`) |
| `feed.xml`, `sitemap.xml`, `llms.txt`, `robots.txt` | Update when adding an article or project |

## Common tasks

- **Add a lab video**: add a `.clip` card to `#lab` in `index.html` and a card in the right era of `archive/index.html`. Save the thumbnail as `media/thumbs/<id>.webp` (640x360). For a hover preview, add `data-preview="media/clips/<name>.mp4"` and create the clip, for example `ffmpeg -ss START -t 4 -i in.mp4 -an -vf "scale=640:360:force_original_aspect_ratio=increase,crop=640:360,fps=24,format=yuv420p" -c:v libx264 -crf 29 -movflags +faststart out.mp4`.
- **Archive cards** carry `data-topics` (space-separated: `robot agents percep sim games gfx`). Filter counts are computed by `js/main.js`.
- **Video links** use `https://www.youtube.com/watch?v=ID` with `data-video`; the lightbox embeds them from youtube-nocookie.com. Cards inside a `data-video-group` element can be stepped through with the arrow keys.
- **Images** need `width`, `height`, `alt`, `loading` and `decoding` attributes (the link check enforces this).
- **Update CV**: replace `Alex-Rozgo-CV.pdf`.

## Writing style for site copy

Plain, specific sentences. Name who does what. Tie every number or comparison to something a reader can check (a video, a repo, a run report). Avoid slogans, "X, not Y" reversals, verbless fragments, and filler words such as "governed", "durable" or "seamless".

## Important Notes
- No build process - edit files directly
- The header and footer are repeated in every page; change them in all pages
- Contact uses a mailto link; there is no PHP contact form on GitHub Pages
- All changes to master branch are automatically deployed
