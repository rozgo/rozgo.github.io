# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal portfolio website hosted on GitHub Pages. It's a single-page application built with vanilla HTML, CSS, and JavaScript. There is no package manager, build process, PHP backend, or frontend framework.

## Commands

### Development
- **Local preview**: Open `index.html` directly in a browser or use a local web server (e.g., `python -m http.server 8000`)
- **Link check**: `python scripts/check_links.py --youtube`
- **Deploy**: Push to master branch - GitHub Pages automatically deploys changes

### Common Tasks
- **Update portfolio videos**: Edit the portfolio section in `index.html` (lines ~300-1500)
- **Add testimonials**: Update the timeline section in `index.html` (lines ~1600-2100)
- **Modify styles**: Edit `css/site.css` for layout/interactions, `css/mystyles.css` for custom styles, or `css/agency.css` for legacy theme styles
- **Update CV**: Replace `Alex-Rozgo-CV.pdf` with new version

## Architecture

### Key Files
- `index.html`: Single-page application containing all content sections
- `css/mystyles.css`: Custom styling overrides
- `css/site.css`: Modern local layout, portfolio grid, and lightbox styles
- `js/site.js`: Main JavaScript for navigation, filtering, and the portfolio lightbox
- `scripts/check_links.py`: Local/CI validator for static links, image attributes, stale domains, and YouTube availability

### Content Structure
The site uses a section-based layout with smooth scrolling navigation:
1. **Hero/Intro** (#page-top)
2. **Portfolio** (#game-portfolio) - CSS Grid portfolio with YouTube video lightbox
3. **Reviews** (#about) - Timeline of professional testimonials
4. **Articles** (#articles) - Article links and thumbnails
5. **About Me** (#team) - Personal background
6. **Technologies** - Skills summary
7. **Contact** (#contact) - Email and social links

### Portfolio System
The portfolio uses local CSS and vanilla JavaScript:
- Items are defined as `.cbp-item` divs with category classes
- Filters use `data-filter` attributes (e.g., `.unreal`, `.games`, `.ai`)
- Each item has a thumbnail, title, and YouTube link
- `js/site.js` opens YouTube videos in a lightweight modal

### Styling Approach
- Legacy theme styles live in `css/agency.css`
- Portfolio, navigation compatibility, lightbox, and framework replacement styles live in `css/site.css`
- Custom content styles and palette live in `css/mystyles.css`

## Important Notes
- No build process - edit files directly
- Images should be optimized before adding (portfolio thumbnails: ~400x300px)
- YouTube links should use a normal `https://www.youtube.com/watch?v=...` URL so the lightbox can embed them
- Contact uses a mailto link; there is no PHP contact form on GitHub Pages
- All changes to master branch are automatically deployed
