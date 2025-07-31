# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal portfolio website hosted on GitHub Pages. It's a single-page application built with vanilla HTML, CSS, and JavaScript, using Bootstrap for responsive design and jQuery for interactivity.

## Commands

### Development
- **Local preview**: Open `index.html` directly in a browser or use a local web server (e.g., `python -m http.server 8000`)
- **Deploy**: Push to master branch - GitHub Pages automatically deploys changes

### Common Tasks
- **Update portfolio videos**: Edit the portfolio section in `index.html` (lines ~300-1500)
- **Add testimonials**: Update the timeline section in `index.html` (lines ~1600-2100)
- **Modify styles**: Edit `css/mystyles.css` for custom styles or `css/agency.css` for theme overrides
- **Update CV**: Replace `Alex-Rozgo-CV.pdf` with new version

## Architecture

### Key Files
- `index.html`: Single-page application containing all content sections
- `css/mystyles.css`: Custom styling overrides
- `js/agency.js`: Main JavaScript for navigation and interactions
- `mail/contact_me.php`: Contact form handler (requires PHP server)

### Content Structure
The site uses a section-based layout with smooth scrolling navigation:
1. **Hero/Intro** (#page-top)
2. **Portfolio** (#portfolio) - CubePortfolio grid with YouTube video embeds
3. **Reviews** (#reviews) - Timeline of professional testimonials
4. **About** (#about) - Personal background
5. **Technologies** (#services) - Skills grid
6. **Contact** (#contact) - Contact form and social links

### JavaScript Libraries
- **jQuery 1.11.1**: DOM manipulation and event handling
- **Bootstrap 3.3.7**: Responsive framework
- **CubePortfolio**: Advanced portfolio filtering and modal display
- **jQuery Easing**: Smooth scrolling animations

### Portfolio System
The portfolio uses CubePortfolio for filtering and display:
- Items are defined as `.cbp-item` divs with data attributes
- Filters use `data-filter` attributes (e.g., `.vr`, `.game`, `.ai`)
- Each item has thumbnail and lightbox content
- YouTube videos embedded with iframe API

### Styling Approach
- Base styles from Bootstrap and Agency theme
- Custom overrides in `mystyles.css`
- Color scheme: Dark backgrounds (#1a1a1a), purple/pink accents (#4a3347, #f94d6f)
- Responsive breakpoints follow Bootstrap standards

## Important Notes
- No build process - edit files directly
- Images should be optimized before adding (portfolio thumbnails: ~400x300px)
- YouTube video IDs must be extracted from share URLs for embedding
- Contact form requires PHP server to function (won't work on GitHub Pages)
- All changes to master branch are automatically deployed